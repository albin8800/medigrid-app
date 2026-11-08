const { Pool } = require('pg');

let pool = null;
let isConnected = false;

/**
 * Check if the database should run in in-memory mock mode.
 * During automated tests (NODE_ENV=test) or when USE_REAL_DB is not 'true',
 * runs in mock mode for blazing fast, isolated test execution.
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
      console.error('Unexpected error on idle pg client in pharmacy-service', err);
      isConnected = false;
    });

    return pool;
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool in pharmacy-service:', err);
    isConnected = false;
    pool = null;
    return null;
  }
}

/**
 * Execute a query against PostgreSQL
 */
async function query(text, params) {
  if (isMockMode()) {
    return { rows: [], rowCount: 0 };
  }

  const p = initDb();
  if (!p) {
    return { rows: [], rowCount: 0 };
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
      console.error('Error closing PostgreSQL pool in pharmacy-service:', err);
    } finally {
      pool = null;
      isConnected = false;
    }
  }
}

module.exports = {
  initDb,
  query,
  checkDbStatus,
  closeDb,
  isMockMode,
  getPool: () => pool
};
