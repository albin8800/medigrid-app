const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/services/order.service');

describe('Multi-Tenant POS Billing & Admin Analytics API Integration Tests', () => {
  beforeEach(() => {
    orderService.clear();
    orderService.resetStockDeductor();
    orderService.resetStoreVerifier();
  });

  describe('POST /api/v1/bills (Store-Isolated Billing)', () => {
    it('should return 403 Forbidden when creating a bill for a SUSPENDED store', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      const res = await request(app)
        .post('/api/v1/bills')
        .send({
          storeId: 'store-003', // Lifecare Pharmacy is SUSPENDED
          customerName: 'Priya Sharma',
          items: [
            { medicineId: 'med-01', medicineName: 'Dolo 650', quantity: 2, unitPrice: 30.0 }
          ]
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('suspended');
    });

    it('should return 404 Not Found when creating a bill for an unknown store', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      const res = await request(app)
        .post('/api/v1/bills')
        .send({
          storeId: 'unknown-store-404',
          customerName: 'Priya Sharma',
          items: [
            { medicineId: 'med-01', medicineName: 'Dolo 650', quantity: 1, unitPrice: 30.0 }
          ]
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should create bill receipt scoped to store-002 and deduct stock', async () => {
      let deductedStore = null;
      orderService.setStockDeductor(async (medId, qty, storeId) => {
        deductedStore = storeId;
        return { success: true };
      });

      const res = await request(app)
        .post('/api/v1/bills')
        .send({
          storeId: 'store-002',
          customerName: 'Vijay Kumar',
          paymentMethod: 'CARD',
          items: [
            { medicineId: 'med-02', medicineName: 'Augmentin 625', quantity: 1, unitPrice: 200.0 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storeId).toBe('store-002');
      expect(res.body.data.billId).toMatch(/^BILL-/);
      expect(deductedStore).toBe('store-002');
    });
  });

  describe('GET /api/v1/bills?storeId=... (Tenant Isolation)', () => {
    beforeEach(async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Store 1 Customer A',
        items: [{ medicineId: 'm1', quantity: 1, unitPrice: 50.0 }]
      });

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Store 1 Customer B',
        items: [{ medicineId: 'm2', quantity: 2, unitPrice: 40.0 }]
      });

      await orderService.createBill({
        storeId: 'store-002',
        customerName: 'Store 2 Customer A',
        items: [{ medicineId: 'm3', quantity: 1, unitPrice: 150.0 }]
      });
    });

    it('should return bills strictly belonging to store-001', async () => {
      const res = await request(app)
        .get('/api/v1/bills')
        .query({ storeId: 'store-001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every((b) => b.storeId === 'store-001')).toBe(true);
    });

    it('should return bills strictly belonging to store-002', async () => {
      const res = await request(app)
        .get('/api/v1/bills')
        .query({ storeId: 'store-002' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].storeId).toBe('store-002');
    });
  });

  describe('GET /api/v1/admin/analytics (Platform-Wide Analytics)', () => {
    beforeEach(async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      await orderService.createBill({
        storeId: 'store-001',
        items: [
          { medicineId: 'med-dolo', medicineName: 'Dolo 650', quantity: 5, unitPrice: 30.0 }
        ]
      });

      await orderService.createBill({
        storeId: 'store-002',
        items: [
          { medicineId: 'med-dolo', medicineName: 'Dolo 650', quantity: 3, unitPrice: 30.0 },
          { medicineId: 'med-pan', medicineName: 'Pan 40', quantity: 2, unitPrice: 85.0 }
        ]
      });
    });

    it('should return aggregated platform-wide sales analytics', async () => {
      const res = await request(app).get('/api/v1/admin/analytics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const { totalStores, totalRevenue, totalBills, topSellingMedicines, storeBreakdown } = res.body.data;
      expect(totalStores).toBe(2);
      expect(totalBills).toBe(2);
      expect(totalRevenue).toBeGreaterThan(0);

      expect(topSellingMedicines).toBeDefined();
      expect(topSellingMedicines[0].medicineName).toBe('Dolo 650');
      expect(topSellingMedicines[0].quantitySold).toBe(8);

      expect(storeBreakdown).toHaveLength(2);
    });
  });
});
