const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');

const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  RESERVED: 'RESERVED',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED'
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [OrderStatus.PENDING]: [OrderStatus.RESERVED, OrderStatus.CANCELLED],
  [OrderStatus.RESERVED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: []
});

class OrderService {
  constructor() {
    this.stockChecker = null;
    this.stockReleaser = null;
  }

  /**
   * Set a custom stock checker stub (e.g. for testing)
   */
  setStockChecker(checkerFn) {
    this.stockChecker = checkerFn;
  }

  /**
   * Reset stock checker stub to default
   */
  resetStockChecker() {
    this.stockChecker = null;
  }

  /**
   * Set a custom stock releaser stub (e.g. for testing)
   */
  setStockReleaser(releaserFn) {
    this.stockReleaser = releaserFn;
  }

  /**
   * Reset stock releaser stub to default
   */
  resetStockReleaser() {
    this.stockReleaser = null;
  }

  /**
   * Validate if a state transition is permitted
   */
  isValidTransition(fromStatus, toStatus) {
    if (!fromStatus || !toStatus) return false;
    const allowed = ALLOWED_TRANSITIONS[fromStatus];
    return Array.isArray(allowed) && allowed.includes(toStatus);
  }

  /**
   * Transition order to a new state if valid
   */
  transitionState(order, nextStatus, reason) {
    if (!this.isValidTransition(order.status, nextStatus)) {
      const err = new Error(
        `Invalid state transition from ${order.status} to ${nextStatus}`
      );
      err.statusCode = 400;
      throw err;
    }

    order.status = nextStatus;
    if (reason) {
      order.cancellationReason = reason;
    }
    order.updatedAt = new Date().toISOString();
    return order;
  }

  /**
   * Reserve stock via custom stub, inter-service HTTP check, or default mock
   */
  async reserveStock(pharmacyId, items) {
    // 1. Custom mockable stub if registered
    if (typeof this.stockChecker === 'function') {
      return await this.stockChecker(pharmacyId, items);
    }

    // 2. Inter-service HTTP check if PHARMACY_SERVICE_URL configured
    if (process.env.PHARMACY_SERVICE_URL) {
      try {
        const response = await axios.get(
          `${process.env.PHARMACY_SERVICE_URL}/api/v1/pharmacies/${pharmacyId}`,
          { timeout: 3000 }
        );
        const pharmacy = response.data && response.data.data ? response.data.data : response.data;
        if (!pharmacy || !Array.isArray(pharmacy.inventory)) {
          return { success: false, reason: `Pharmacy ${pharmacyId} inventory unavailable` };
        }

        for (const item of items) {
          const invItem = pharmacy.inventory.find(
            (inv) => inv.name && inv.name.toLowerCase() === item.medicine.toLowerCase()
          );
          if (!invItem || (invItem.quantity ?? 0) < item.quantity) {
            return {
              success: false,
              reason: `Insufficient stock for medicine: ${item.medicine}`
            };
          }
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          reason: `Pharmacy service check failed: ${err.message}`
        };
      }
    }

    // 3. Default fallback stub: check individual items for simulated failure or stock flags
    for (const item of items) {
      if (
        item.simulateStockFailure === true ||
        item.available === false ||
        item.inStock === false ||
        (typeof item.availableStock === 'number' && item.availableStock < item.quantity)
      ) {
        return {
          success: false,
          reason: `Insufficient stock for medicine: ${item.medicine}`
        };
      }
    }

    return { success: true };
  }

  /**
   * Release reserved stock on order cancellation
   */
  async releaseStock(pharmacyId, items) {
    if (typeof this.stockReleaser === 'function') {
      return await this.stockReleaser(pharmacyId, items);
    }
    return { success: true };
  }

  /**
   * Validate required order fields and normalize items
   */
  _validateAndNormalizeOrderInput({ customerId, pharmacyId, items, deliveryAddress }) {
    if (!customerId || (typeof customerId === 'string' && customerId.trim() === '')) {
      const err = new Error('Customer ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!pharmacyId || (typeof pharmacyId === 'string' && pharmacyId.trim() === '')) {
      const err = new Error('Pharmacy ID is required');
      err.statusCode = 400;
      throw err;
    }

    if (!deliveryAddress || (typeof deliveryAddress === 'string' && deliveryAddress.trim() === '')) {
      const err = new Error('Delivery address is required');
      err.statusCode = 400;
      throw err;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('Order items must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    const normalizedItems = items.map((item, index) => {
      const medicine = (item.medicine || item.medicineName || item.name || '').trim();
      if (!medicine) {
        const err = new Error(`Item at index ${index} is missing medicine name`);
        err.statusCode = 400;
        throw err;
      }

      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        const err = new Error(
          `Item '${medicine}' quantity must be a positive integer`
        );
        err.statusCode = 400;
        throw err;
      }

      const unitPrice = Number(item.unitPrice ?? item.price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        const err = new Error(
          `Item '${medicine}' unit price must be a non-negative number`
        );
        err.statusCode = 400;
        throw err;
      }

      const subtotal = Math.round(quantity * unitPrice * 100) / 100;

      return {
        medicine,
        quantity,
        unitPrice,
        subtotal,
        ...(item.simulateStockFailure !== undefined ? { simulateStockFailure: item.simulateStockFailure } : {}),
        ...(item.availableStock !== undefined ? { availableStock: item.availableStock } : {}),
        ...(item.available !== undefined ? { available: item.available } : {}),
        ...(item.inStock !== undefined ? { inStock: item.inStock } : {})
      };
    });

    return {
      customerId: String(customerId).trim(),
      pharmacyId: String(pharmacyId).trim(),
      deliveryAddress,
      normalizedItems
    };
  }

  /**
   * Save order to DB or in-memory store
   */
  async _persistOrder(order) {
    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const sql = `
            INSERT INTO orders (id, customer_id, pharmacy_id, items, delivery_address, total_amount, status, cancellation_reason, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
              status = EXCLUDED.status,
              cancellation_reason = EXCLUDED.cancellation_reason,
              updated_at = EXCLUDED.updated_at
            RETURNING *;
          `;
          await pool.query(sql, [
            order.id,
            order.customerId,
            order.pharmacyId,
            JSON.stringify(order.items),
            JSON.stringify(order.deliveryAddress),
            order.totalAmount,
            order.status,
            order.cancellationReason || null,
            order.createdAt,
            order.updatedAt
          ]);
        }
      } catch (err) {
        // Fall back to mock store if pg error occurs
        console.warn('Postgres persist failed, updating mock store:', err.message);
      }
    }
    return db.mockStore.saveOrder(order);
  }

  /**
   * Create a new order with stock reservation and total calculation
   */
  async createOrder({ customerId, pharmacyId, items, deliveryAddress }) {
    const validated = this._validateAndNormalizeOrderInput({
      customerId,
      pharmacyId,
      items,
      deliveryAddress
    });

    // Compute total amount rounded to 2 decimal places
    const totalAmount =
      Math.round(
        validated.normalizedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
      ) / 100;

    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();

    const order = {
      id: orderId,
      customerId: validated.customerId,
      pharmacyId: validated.pharmacyId,
      items: validated.normalizedItems,
      deliveryAddress: validated.deliveryAddress,
      totalAmount,
      status: OrderStatus.PENDING,
      cancellationReason: null,
      createdAt: now,
      updatedAt: now
    };

    // 1. Transition PENDING -> RESERVED
    this.transitionState(order, OrderStatus.RESERVED);

    // 2. Check and reserve stock
    const stockResult = await this.reserveStock(
      order.pharmacyId,
      order.items
    );

    if (!stockResult.success) {
      // 3a. Stock failed: transition RESERVED -> CANCELLED
      const failReason = stockResult.reason || 'Insufficient stock';
      this.transitionState(order, OrderStatus.CANCELLED, failReason);
      await this._persistOrder(order);

      const err = new Error(`Stock reservation failed: ${failReason}`);
      err.statusCode = 409;
      err.order = order;
      throw err;
    }

    // 3b. Stock succeeded: transition RESERVED -> CONFIRMED
    this.transitionState(order, OrderStatus.CONFIRMED);
    await this._persistOrder(order);

    return order;
  }

  /**
   * Retrieve order details by ID
   */
  async getOrderById(orderId) {
    if (!orderId) {
      return null;
    }

    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const res = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
          if (res.rows && res.rows.length > 0) {
            const row = res.rows[0];
            return {
              id: row.id,
              customerId: row.customer_id,
              pharmacyId: row.pharmacy_id,
              items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
              deliveryAddress: typeof row.delivery_address === 'string' ? JSON.parse(row.delivery_address) : row.delivery_address,
              totalAmount: parseFloat(row.total_amount),
              status: row.status,
              cancellationReason: row.cancellation_reason,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            };
          }
        }
      } catch (err) {
        console.warn('Postgres fetch failed, falling back to mock store:', err.message);
      }
    }

    return db.mockStore.getOrder(orderId);
  }

  /**
   * Cancel an order if cancellable, releasing reserved stock
   */
  async cancelOrder(orderId, reason = 'Cancelled by customer') {
    const order = await this.getOrderById(orderId);
    if (!order) {
      const err = new Error(`Order with id '${orderId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (order.status === OrderStatus.CANCELLED) {
      const err = new Error(`Order '${orderId}' is already cancelled`);
      err.statusCode = 400;
      throw err;
    }

    // Transition to CANCELLED
    this.transitionState(order, OrderStatus.CANCELLED, reason);

    // Release stock reservation
    await this.releaseStock(order.pharmacyId, order.items);

    // Save updated order
    await this._persistOrder(order);

    return order;
  }

  /**
   * List orders with optional filters (e.g. status)
   */
  async listOrders(filters = {}) {
    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          let sql = 'SELECT * FROM orders WHERE 1=1';
          const params = [];
          let paramIdx = 1;

          if (filters.status) {
            sql += ` AND UPPER(status) = $${paramIdx++}`;
            params.push(filters.status.toUpperCase());
          }
          if (filters.customerId) {
            sql += ` AND customer_id = $${paramIdx++}`;
            params.push(filters.customerId);
          }
          if (filters.pharmacyId) {
            sql += ` AND pharmacy_id = $${paramIdx++}`;
            params.push(filters.pharmacyId);
          }

          sql += ' ORDER BY created_at DESC';

          const res = await pool.query(sql, params);
          if (res.rows) {
            return res.rows.map((row) => ({
              id: row.id,
              customerId: row.customer_id,
              pharmacyId: row.pharmacy_id,
              items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
              deliveryAddress: typeof row.delivery_address === 'string' ? JSON.parse(row.delivery_address) : row.delivery_address,
              totalAmount: parseFloat(row.total_amount),
              status: row.status,
              cancellationReason: row.cancellation_reason,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));
          }
        }
      } catch (err) {
        console.warn('Postgres query failed, falling back to mock store:', err.message);
      }
    }

    return db.mockStore.listOrders(filters);
  }

  /**
   * Clear in-memory storage (for test isolation)
   */
  clear() {
    db.mockStore.clear();
    this.resetStockChecker();
    this.resetStockReleaser();
  }
}

const orderService = new OrderService();

module.exports = orderService;
module.exports.OrderStatus = OrderStatus;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
module.exports.OrderService = OrderService;
