const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/services/order.service');

describe('In-Store POS & Billing API Integration Tests', () => {
  beforeEach(() => {
    orderService.clear();
    orderService.resetStockDeductor();
  });

  describe('POST /api/v1/bills', () => {
    it('should create bill receipt and return 201 Created', async () => {
      orderService.setStockDeductor(async (medicineId, quantity) => ({
        success: true,
        remainingStock: 40
      }));

      const payload = {
        storeId: 'store-001',
        customerName: 'Robert Green',
        customerPhone: '+1-555-8888',
        paymentMethod: 'UPI',
        items: [
          { medicineId: 'med-01', medicineName: 'Amoxicillin 500mg', quantity: 2, unitPrice: 50.0 },
          { medicineId: 'med-02', medicineName: 'Paracetamol 650mg', quantity: 3, unitPrice: 20.0 }
        ],
        discountAmount: 10.0
      };

      const res = await request(app)
        .post('/api/v1/bills')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.billId).toMatch(/^BILL-/);
      expect(res.body.data.status).toBe('PAID');
      expect(res.body.data.customerName).toBe('Robert Green');
      // Subtotal = (2 * 50) + (3 * 20) = 160.00
      expect(res.body.data.subtotal).toBe(160.0);
      expect(res.body.data.discountAmount).toBe(10.0);
      // Taxable = 150.00; Tax (5%) = 7.50; Final = 157.50
      expect(res.body.data.taxAmount).toBe(7.5);
      expect(res.body.data.finalTotal).toBe(157.5);
    });

    it('should return 409 Conflict when stock deduction fails', async () => {
      orderService.setStockDeductor(async (medicineId) => {
        const err = new Error(`Insufficient stock for medicine '${medicineId}'. Available: 1, Requested: 5`);
        err.statusCode = 409;
        throw err;
      });

      const payload = {
        items: [
          { medicineId: 'med-low', medicineName: 'Low Stock Med', quantity: 5, unitPrice: 20.0 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/bills')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Insufficient stock');
    });

    it('should return 400 Bad Request on missing items', async () => {
      const res = await request(app)
        .post('/api/v1/bills')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 Bad Request on invalid item parameters', async () => {
      const res = await request(app)
        .post('/api/v1/bills')
        .send({
          items: [{ medicineId: 'm1', quantity: -2, unitPrice: 10 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/bills/:id', () => {
    it('should fetch bill details by billId', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      const bill = await orderService.createBill({
        customerName: 'Sam Spade',
        items: [{ medicineId: 'med-01', medicineName: 'Aspirin', quantity: 2, unitPrice: 10.0 }]
      });

      const res = await request(app).get(`/api/v1/bills/${bill.billId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.billId).toBe(bill.billId);
      expect(res.body.data.customerName).toBe('Sam Spade');
      expect(res.body.data.status).toBe('PAID');
    });

    it('should return 404 if bill does not exist', async () => {
      const res = await request(app).get('/api/v1/bills/BILL-NON-EXISTENT');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('GET /api/v1/bills', () => {
    beforeEach(async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer A',
        items: [{ medicineId: 'm1', quantity: 1, unitPrice: 50.0 }]
      });

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer B',
        items: [{ medicineId: 'm2', quantity: 1, unitPrice: 100.0 }]
      });

      await orderService.createBill({
        storeId: 'store-002',
        customerName: 'Customer C',
        items: [{ medicineId: 'm3', quantity: 1, unitPrice: 200.0 }]
      });
    });

    it('should list all bills with aggregate revenue', async () => {
      const res = await request(app).get('/api/v1/bills');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);
      expect(res.body.totalRevenue).toBeGreaterThan(0);
      expect(res.body.data).toHaveLength(3);
    });

    it('should filter bills by storeId and calculate store revenue', async () => {
      const res = await request(app)
        .get('/api/v1/bills')
        .query({ storeId: 'store-001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every((b) => b.storeId === 'store-001')).toBe(true);
    });
  });
});
