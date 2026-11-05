const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/services/order.service');
const { closeDb } = require('../../src/config/db');

describe('Order API Integration Tests', () => {
  beforeEach(() => {
    orderService.clear();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('POST /api/v1/orders', () => {
    it('should create an order successfully and return 201 Created', async () => {
      const payload = {
        customerId: 'cust-api-1',
        pharmacyId: 'pharma-api-1',
        deliveryAddress: {
          street: '123 Test St',
          city: 'Health City',
          zip: '12345'
        },
        items: [
          { medicine: 'Amoxicillin 500mg', quantity: 2, unitPrice: 15.0 },
          { medicine: 'Vitamin D3', quantity: 1, unitPrice: 10.0 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.customerId).toBe('cust-api-1');
      expect(res.body.data.pharmacyId).toBe('pharma-api-1');
      expect(res.body.data.totalAmount).toBe(40.0);
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.items).toHaveLength(2);
    });

    it('should return 400 when required fields are missing', async () => {
      // Missing customerId
      const res1 = await request(app)
        .post('/api/v1/orders')
        .send({
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Main St',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: 5 }]
        });
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error).toContain('Customer ID is required');

      // Missing pharmacyId
      const res2 = await request(app)
        .post('/api/v1/orders')
        .send({
          customerId: 'cust-1',
          deliveryAddress: '123 Main St',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: 5 }]
        });
      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error).toContain('Pharmacy ID is required');

      // Empty items array
      const res3 = await request(app)
        .post('/api/v1/orders')
        .send({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Main St',
          items: []
        });
      expect(res3.status).toBe(400);
      expect(res3.body.success).toBe(false);
      expect(res3.body.error).toContain('items must be a non-empty array');
    });

    it('should return 409 Conflict when stock reservation fails', async () => {
      const payload = {
        customerId: 'cust-stock-fail',
        pharmacyId: 'pharma-1',
        deliveryAddress: '404 Stock Lane',
        items: [
          { medicine: 'Scarce Drug', quantity: 5, unitPrice: 20.0, simulateStockFailure: true }
        ]
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Stock reservation failed');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('CANCELLED');
    });
  });

  describe('GET /api/v1/orders/:id', () => {
    it('should return 200 with order details when order exists', async () => {
      const order = await orderService.createOrder({
        customerId: 'cust-get-1',
        pharmacyId: 'pharma-1',
        deliveryAddress: '100 Broadway',
        items: [{ medicine: 'Paracetamol', quantity: 1, unitPrice: 4.5 }]
      });

      const res = await request(app).get(`/api/v1/orders/${order.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.totalAmount).toBe(4.5);
      expect(res.body.data.status).toBe('CONFIRMED');
    });

    it('should return 404 Not Found when order does not exist', async () => {
      const res = await request(app).get('/api/v1/orders/non-existent-order-id');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('PATCH /api/v1/orders/:id/cancel', () => {
    it('should return 200 and cancel an active order', async () => {
      const order = await orderService.createOrder({
        customerId: 'cust-cancel-api',
        pharmacyId: 'pharma-1',
        deliveryAddress: '200 Elm St',
        items: [{ medicine: 'Ibuprofen', quantity: 2, unitPrice: 6.0 }]
      });

      const res = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: 'Found cheaper alternative' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancellationReason).toBe('Found cheaper alternative');
    });

    it('should return 400 when attempting to cancel an already cancelled order', async () => {
      const order = await orderService.createOrder({
        customerId: 'cust-cancel-twice',
        pharmacyId: 'pharma-1',
        deliveryAddress: '200 Elm St',
        items: [{ medicine: 'Ibuprofen', quantity: 2, unitPrice: 6.0 }]
      });

      await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: 'First cancel' });

      const res = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: 'Second cancel' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already cancelled');
    });

    it('should return 404 when cancelling a non-existent order', async () => {
      const res = await request(app)
        .patch('/api/v1/orders/random-id/cancel')
        .send({ reason: 'Cancel invalid' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('GET /api/v1/orders', () => {
    it('should list all orders and support filtering by status', async () => {
      const order1 = await orderService.createOrder({
        customerId: 'cust-list-1',
        pharmacyId: 'pharma-1',
        deliveryAddress: 'Addr 1',
        items: [{ medicine: 'Med A', quantity: 1, unitPrice: 10 }]
      });

      const order2 = await orderService.createOrder({
        customerId: 'cust-list-2',
        pharmacyId: 'pharma-2',
        deliveryAddress: 'Addr 2',
        items: [{ medicine: 'Med B', quantity: 1, unitPrice: 20 }]
      });

      await orderService.cancelOrder(order2.id, 'Cancelled for test');

      // 1. List all
      const resAll = await request(app).get('/api/v1/orders');
      expect(resAll.status).toBe(200);
      expect(resAll.body.success).toBe(true);
      expect(resAll.body.count).toBe(2);

      // 2. Filter CONFIRMED
      const resConfirmed = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'CONFIRMED' });
      expect(resConfirmed.status).toBe(200);
      expect(resConfirmed.body.count).toBe(1);
      expect(resConfirmed.body.data[0].id).toBe(order1.id);

      // 3. Filter CANCELLED
      const resCancelled = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'CANCELLED' });
      expect(resCancelled.status).toBe(200);
      expect(resCancelled.body.count).toBe(1);
      expect(resCancelled.body.data[0].id).toBe(order2.id);
    });
  });
});
