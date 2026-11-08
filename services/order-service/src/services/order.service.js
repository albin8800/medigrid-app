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
    this.stockDeductor = null;
    this.storeVerifier = null;
    this.knownStores = new Map(); // Clean production baseline: 0 stores pre-loaded
  }

  /**
   * Reset default known stores map
   */
  resetStores() {
    this.knownStores = new Map([
      ['store-001', { id: 'store-001', name: 'Apollo Pharmacy - Indiranagar', status: 'ACTIVE' }],
      ['store-002', { id: 'store-002', name: 'MedPlus Chemist - Koramangala', status: 'ACTIVE' }],
      ['store-003', { id: 'store-003', name: 'Lifecare Pharmacy - HSR Layout', status: 'SUSPENDED' }]
    ]);
  }

  /**
   * Set status for a store in mock store registry
   */
  setStoreStatus(storeId, status) {
    const existing = this.knownStores.get(storeId) || { id: storeId, name: `Store ${storeId}` };
    existing.status = status;
    this.knownStores.set(storeId, existing);
  }

  /**
   * Set a custom store verifier stub (e.g. for testing)
   */
  setStoreVerifier(verifierFn) {
    this.storeVerifier = verifierFn;
  }

  /**
   * Reset store verifier stub to default
   */
  resetStoreVerifier() {
    this.storeVerifier = null;
  }

  /**
   * Verify store exists and is ACTIVE
   */
  async verifyStoreActive(storeId) {
    if (typeof this.storeVerifier === 'function') {
      return await this.storeVerifier(storeId);
    }

    const catalogUrl = process.env.CATALOG_SERVICE_URL || process.env.PHARMACY_SERVICE_URL;
    if (catalogUrl && process.env.NODE_ENV !== 'test') {
      try {
        const response = await axios.get(`${catalogUrl}/api/v1/admin/stores/${storeId}`, { timeout: 3000 });
        const store = response.data?.data || response.data;
        if (!store || store.status !== 'ACTIVE') {
          const err = new Error(`Store '${storeId}' is suspended or inactive`);
          err.statusCode = 403;
          throw err;
        }
        return store;
      } catch (err) {
        if (err.statusCode) throw err;
      }
    }

    const store = this.knownStores.get(storeId);
    if (!store) {
      const err = new Error(`Store with id '${storeId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (store.status === 'SUSPENDED') {
      const err = new Error(`Store '${storeId}' is suspended`);
      err.statusCode = 403;
      throw err;
    }

    return store;
  }

  /**
   * Set a custom stock deductor stub (e.g. for testing)
   */
  setStockDeductor(deductorFn) {
    this.stockDeductor = deductorFn;
  }

  /**
   * Reset stock deductor stub to default
   */
  resetStockDeductor() {
    this.stockDeductor = null;
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

    // 2. Inter-service HTTP check if PHARMACY_SERVICE_URL configured (disabled in unit test mode)
    if (process.env.PHARMACY_SERVICE_URL && process.env.NODE_ENV !== 'test') {
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
              reason: `Insufficient stock for medicine: ${item.medicine}. Available: ${invItem?.quantity ?? 0}, Requested: ${item.quantity}`
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
        const avail = typeof item.availableStock === 'number' ? item.availableStock : 0;
        return {
          success: false,
          reason: `Insufficient stock for medicine: ${item.medicine}. Available: ${avail}, Requested: ${item.quantity}`
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
   * Deduct stock for a medicine item via catalog service stub or HTTP call
   */
  async deductStock(medicineId, quantity, storeId) {
    if (typeof this.stockDeductor === 'function') {
      return await this.stockDeductor(medicineId, quantity, storeId);
    }

    const catalogUrl =
      process.env.CATALOG_SERVICE_URL ||
      process.env.PHARMACY_SERVICE_URL;

    if (!catalogUrl) {
      const error = new Error('Pharmacy catalog service URL not configured in environment (PHARMACY_SERVICE_URL)');
      error.statusCode = 500;
      throw error;
    }

    try {
      const response = await axios.patch(
        `${catalogUrl}/api/v1/medicines/${medicineId}/stock`,
        { action: 'DEDUCT', quantity, ...(storeId ? { storeId } : {}) },
        { timeout: 3000 }
      );
      return response.data;
    } catch (err) {
      if (err.response) {
        const error = new Error(
          err.response.data?.error || `Stock deduction failed for medicine ${medicineId}`
        );
        error.statusCode = err.response.status || 500;
        throw error;
      }
      const error = new Error(
        `Stock deduction failed for medicine ${medicineId}: ${err.message}`
      );
      error.statusCode = 500;
      throw error;
    }
  }

  /**
   * Persist bill to database or mock store
   */
  async _persistBill(bill) {
    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const sql = `
            INSERT INTO bills (bill_id, store_id, customer_name, customer_phone, payment_method, items, subtotal, discount_amount, tax_amount, final_total, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (bill_id) DO UPDATE SET
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at
            RETURNING *;
          `;
          await pool.query(sql, [
            bill.billId,
            bill.storeId,
            bill.customerName,
            bill.customerPhone,
            bill.paymentMethod,
            JSON.stringify(bill.items),
            bill.subtotal,
            bill.discountAmount,
            bill.taxAmount,
            bill.finalTotal,
            bill.status,
            bill.createdAt,
            bill.updatedAt
          ]);
        }
      } catch (err) {
        console.warn('Postgres bill persist failed, using mock store:', err.message);
      }
    }
    return db.mockStore.saveBill(bill);
  }

  /**
   * Create POS in-store bill receipt
   */
  async createBill({ storeId, customerName, customerPhone, paymentMethod, items, discountAmount } = {}) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      const err = new Error('Bill items must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    const targetStoreId = (typeof storeId === 'string' && storeId.trim()) ? storeId.trim() : (storeId || 'store-001');
    await this.verifyStoreActive(targetStoreId);

    const normalizedItems = items.map((item, index) => {
      const medicineId = item.medicineId || item.id;
      if (!medicineId || (typeof medicineId === 'string' && medicineId.trim() === '')) {
        const err = new Error(`Item at index ${index} is missing medicineId`);
        err.statusCode = 400;
        throw err;
      }

      const medicineName = (item.medicineName || item.medicine || item.name || `Medicine ${medicineId}`).trim();

      const quantity = Number(item.quantity);
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        const err = new Error(`Item '${medicineName}' quantity must be a positive integer`);
        err.statusCode = 400;
        throw err;
      }

      const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
      if (isNaN(unitPrice) || unitPrice < 0) {
        const err = new Error(`Item '${medicineName}' unit price must be a non-negative number`);
        err.statusCode = 400;
        throw err;
      }

      const subtotal = Math.round(quantity * unitPrice * 100) / 100;

      return {
        medicineId: String(medicineId).trim(),
        medicineName,
        quantity,
        unitPrice,
        subtotal
      };
    });

    // Deduct stock for each item via catalog service stub / HTTP client
    for (const item of normalizedItems) {
      try {
        await this.deductStock(item.medicineId, item.quantity, targetStoreId);
      } catch (err) {
        if (err.statusCode === 409 || err.statusCode === 400 || err.message?.includes('Insufficient stock')) {
          if (!err.message?.includes(item.medicineName)) {
            err.message = `Insufficient stock for medicine '${item.medicineName}'. ${err.message}`;
          }
          if (!err.statusCode) {
            err.statusCode = 409;
          }
        }
        throw err;
      }
    }

    // Financial calculations
    const subtotal =
      Math.round(
        normalizedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
      ) / 100;

    const rawDiscount = typeof discountAmount === 'number' ? discountAmount : Number(discountAmount || 0);
    const validDiscount = isNaN(rawDiscount) || rawDiscount < 0 ? 0 : rawDiscount;
    const discount = Math.min(validDiscount, subtotal);

    const taxableAmount = Math.round((subtotal - discount) * 100) / 100;
    const taxAmount = Math.round(taxableAmount * 0.05 * 100) / 100; // 5% GST
    const finalTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    let billId = 'BILL-' + Date.now();
    if (db.mockStore.getBill(billId)) {
      billId = `BILL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
    const now = new Date().toISOString();

    const bill = {
      billId,
      storeId: targetStoreId,
      customerName: (customerName && customerName.trim()) || 'Walk-in Customer',
      customerPhone: (customerPhone && customerPhone.trim()) || '',
      paymentMethod: (paymentMethod && paymentMethod.trim().toUpperCase()) || 'CASH',
      items: normalizedItems,
      subtotal,
      discountAmount: discount,
      taxAmount,
      finalTotal,
      status: 'PAID',
      createdAt: now,
      updatedAt: now
    };

    return await this._persistBill(bill);
  }

  /**
   * Get bill details by billId
   */
  async getBillById(billId) {
    if (!billId) {
      return null;
    }
    return db.mockStore.getBill(billId);
  }

  /**
   * List all bills with total revenue metric
   */
  async listBills({ storeId } = {}) {
    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          let sql = 'SELECT * FROM bills WHERE 1=1';
          const params = [];
          if (storeId) {
            sql += ' AND store_id = $1';
            params.push(storeId);
          }
          sql += ' ORDER BY created_at DESC';
          const res = await pool.query(sql, params);
          if (res.rows) {
            const bills = res.rows.map((row) => ({
              billId: row.bill_id,
              storeId: row.store_id,
              customerName: row.customer_name,
              customerPhone: row.customer_phone,
              paymentMethod: row.payment_method,
              items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []),
              subtotal: parseFloat(row.subtotal || 0),
              discountAmount: parseFloat(row.discount_amount || 0),
              taxAmount: parseFloat(row.tax_amount || 0),
              finalTotal: parseFloat(row.final_total || row.total_amount || 0),
              status: row.status,
              createdAt: row.created_at,
              updatedAt: row.updated_at
            }));
            const totalRevenue = Math.round(bills.reduce((sum, b) => sum + (Number(b.finalTotal) || 0), 0) * 100) / 100;
            return { bills, totalRevenue, count: bills.length };
          }
        }
      } catch (err) {
        console.warn('Postgres listBills failed, falling back:', err.message);
      }
    }

    const bills = db.mockStore.listBills({ storeId });
    const totalRevenue =
      Math.round(
        bills.reduce((sum, b) => sum + (Number(b.finalTotal) || 0), 0) * 100
      ) / 100;

    return {
      bills,
      totalRevenue,
      count: bills.length
    };
  }

  /**
   * Platform-wide sales analytics aggregating total stores, total revenue, and top-selling medicines
   */
  async getPlatformAnalytics() {
    let bills = [];
    if (!db.isMockMode() && process.env.DATABASE_URL) {
      try {
        const billRes = await this.listBills();
        bills = billRes.bills || [];
      } catch (err) {
        console.warn('Postgres getPlatformAnalytics bills fetch failed, falling back:', err.message);
        bills = db.mockStore.listBills();
      }
    } else {
      bills = db.mockStore.listBills();
    }

    const totalRevenue =
      Math.round(
        bills.reduce((sum, b) => sum + (Number(b.finalTotal) || 0), 0) * 100
      ) / 100;

    const medMap = new Map();
    const storeMap = new Map();

    for (const bill of bills) {
      const sId = bill.storeId || 'store-001';
      if (!storeMap.has(sId)) {
        storeMap.set(sId, { storeId: sId, totalRevenue: 0, billCount: 0 });
      }
      const sData = storeMap.get(sId);
      sData.totalRevenue = Math.round((sData.totalRevenue + (Number(bill.finalTotal) || 0)) * 100) / 100;
      sData.billCount += 1;

      for (const item of (bill.items || [])) {
        const mId = item.medicineId;
        if (!medMap.has(mId)) {
          medMap.set(mId, {
            medicineId: mId,
            medicineName: item.medicineName || `Medicine ${mId}`,
            quantitySold: 0,
            totalRevenue: 0
          });
        }
        const mData = medMap.get(mId);
        mData.quantitySold += Number(item.quantity || 0);
        mData.totalRevenue = Math.round((mData.totalRevenue + (Number(item.subtotal) || 0)) * 100) / 100;
      }
    }

    const topSellingMedicines = Array.from(medMap.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold
    );

    const storeBreakdown = Array.from(storeMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue
    );

    return {
      totalStores: storeMap.size,
      totalRevenue,
      totalBills: bills.length,
      topSellingMedicines,
      storeBreakdown
    };
  }

  /**
   * Clear in-memory storage (for test isolation)
   */
  clear() {
    db.mockStore.clear();
    this.resetStockChecker();
    this.resetStockReleaser();
    this.resetStockDeductor();
    this.resetStoreVerifier();
    this.resetStores();
  }
}

const orderService = new OrderService();

module.exports = orderService;
module.exports.OrderStatus = OrderStatus;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
module.exports.OrderService = OrderService;
