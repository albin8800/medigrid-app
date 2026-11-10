const { Pool } = require('pg');

let pool = null;
let isConnected = false;

// In-memory mock store fallback for unit and integration testing
class InMemoryDb {
  constructor() {
    this.orders = new Map();
    this.bills = new Map();
  }

  clear() {
    this.orders.clear();
    this.bills.clear();
  }

  saveOrder(order) {
    this.orders.set(order.id, JSON.parse(JSON.stringify(order)));
    return this.orders.get(order.id);
  }

  getOrder(id) {
    const order = this.orders.get(id);
    return order ? JSON.parse(JSON.stringify(order)) : null;
  }

  updateOrder(order) {
    if (!this.orders.has(order.id)) {
      return null;
    }
    this.orders.set(order.id, JSON.parse(JSON.stringify(order)));
    return this.orders.get(order.id);
  }

  listOrders(filters = {}) {
    let results = Array.from(this.orders.values());

    if (filters.status) {
      results = results.filter(
        (o) => o.status.toUpperCase() === filters.status.toUpperCase()
      );
    }
    if (filters.customerId) {
      results = results.filter((o) => o.customerId === filters.customerId);
    }
    if (filters.pharmacyId) {
      results = results.filter((o) => o.pharmacyId === filters.pharmacyId);
    }

    // Sort descending by creation date
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.map((o) => JSON.parse(JSON.stringify(o)));
  }

  saveBill(bill) {
    this.bills.set(bill.billId, JSON.parse(JSON.stringify(bill)));
    return this.bills.get(bill.billId);
  }

  getBill(billId) {
    const bill = this.bills.get(billId);
    return bill ? JSON.parse(JSON.stringify(bill)) : null;
  }

  listBills(filters = {}) {
    let results = Array.from(this.bills.values());

    if (filters.storeId) {
      results = results.filter((b) => b.storeId === filters.storeId);
    }

    // Sort descending by creation date
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.map((b) => JSON.parse(JSON.stringify(b)));
  }

  async query(text, params = []) {
    const trimmed = (text || '').trim().toUpperCase();

    if (trimmed.startsWith('SELECT 1') || trimmed.startsWith('SELECT NOW()')) {
      return {
        rows: [{ '?column?': 1, now: new Date().toISOString() }],
        rowCount: 1
      };
    }

    return { rows: [], rowCount: 0 };
  }
}

const mockDb = new InMemoryDb();

/**
 * Check if the database should run in in-memory mock mode.
 */
function isMockMode() {
  if (process.env.USE_REAL_DB === 'true' && process.env.DATABASE_URL) {
    return false;
  }
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === 'test') {
    return true;
  }
  return false;
}

/**
 * Initialize PostgreSQL connection pool wrapper using pg
 */
function initDb() {
  if (isMockMode()) {
    return null;
  }

  if (pool) {
    return pool;
  }

  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pool.on('connect', () => {
      isConnected = true;
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle pg client', err);
      isConnected = false;
    });

    return pool;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool:', err);
    isConnected = false;
    pool = null;
    return null;
  }
}

/**
 * Execute a query against PostgreSQL or fallback in-memory mock
 */
async function query(text, params) {
  if (isMockMode()) {
    return mockDb.query(text, params);
  }

  const p = initDb();
  if (!p) {
    return mockDb.query(text, params);
  }

  return p.query(text, params);
}

/**
 * Check DB status for readiness probe
 */
async function checkDbStatus() {
  if (isMockMode()) {
    return {
      connected: true,
      status: 'ready (in-memory mock mode)',
      type: 'mock-memory'
    };
  }

  const p = initDb();
  if (!p) {
    return {
      connected: false,
      status: 'unavailable',
      type: 'postgres'
    };
  }

  try {
    const res = await p.query('SELECT 1 AS health');
    if (res && res.rows && res.rows.length > 0) {
      isConnected = true;
      return {
        connected: true,
        status: 'connected',
        type: 'postgres'
      };
    }
    isConnected = false;
    return {
      connected: false,
      status: 'disconnected',
      type: 'postgres'
    };
  } catch (err) {
    isConnected = false;
    return {
      connected: false,
      status: 'disconnected',
      type: 'postgres',
      error: err.message
    };
  }
}

/**
 * Close PostgreSQL pool gracefully
 */
async function closeDb() {
  if (pool) {
    try {
      await pool.end();
    } catch (err) {
      console.error('Error closing PostgreSQL pool:', err);
    } finally {
      pool = null;
      isConnected = false;
    }
  }
  mockDb.clear();
}

module.exports = {
  initDb,
  query,
  checkDbStatus,
  closeDb,
  isMockMode,
  getPool: () => pool,
  mockStore: mockDb
};
