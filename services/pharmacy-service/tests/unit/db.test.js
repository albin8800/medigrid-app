const db = require('../../src/config/db');

describe('Database Configuration & Health Probe (db.js)', () => {
  afterAll(async () => {
    await db.closeDb();
  });

  describe('Mock Mode Detection', () => {
    it('should operate in mock mode when NODE_ENV is test', () => {
      expect(db.isMockMode()).toBe(true);
    });

    it('should return mock-ready status from checkDbStatus in mock mode', async () => {
      const status = await db.checkDbStatus();
      expect(status).toMatchObject({
        connected: true,
        type: 'mock-memory'
      });
      expect(status.status).toContain('ready');
    });

    it('should return empty result safely when query is called in mock mode', async () => {
      const res = await db.query('SELECT 1');
      expect(res).toEqual({ rows: [], rowCount: 0 });
    });
  });

  describe('PostgreSQL Connection Pool Handling', () => {
    it('should handle pool closing gracefully without throwing', async () => {
      await expect(db.closeDb()).resolves.not.toThrow();
    });
  });
});
