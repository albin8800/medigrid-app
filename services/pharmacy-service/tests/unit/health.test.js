const request = require('supertest');
const app = require('../../src/app');

describe('Health & Readiness Endpoints', () => {
  describe('GET /healthz', () => {
    it('should return 200 with status UP, service name, and timestamp', async () => {
      const response = await request(app).get('/healthz');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'UP');
      expect(response.body).toHaveProperty('service', 'pharmacy-service');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('GET /ready', () => {
    it('should return 200 with status READY and connectivity details', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'READY');
      expect(response.body).toHaveProperty('service', 'pharmacy-service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('redis');
    });
  });
});
