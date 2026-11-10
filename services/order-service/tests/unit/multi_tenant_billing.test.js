const orderService = require('../../src/services/order.service');

describe('Multi-Tenant POS Billing & Analytics Unit Tests (order.service)', () => {
  beforeEach(() => {
    orderService.clear();
    orderService.resetStockDeductor();
    orderService.resetStoreVerifier();
  });

  describe('Tenant Scoping & Store Verification', () => {
    it('should reject bill creation if store is SUSPENDED', async () => {
      // store-003 is SUSPENDED
      const payload = {
        storeId: 'store-003',
        customerName: 'Alice',
        items: [{ medicineId: 'med-01', medicineName: 'Dolo 650', quantity: 1, unitPrice: 30.0 }]
      };

      await expect(orderService.createBill(payload)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('suspended')
      });
    });

    it('should reject bill creation if store is unknown/not found', async () => {
      const payload = {
        storeId: 'unknown-store-999',
        customerName: 'Bob',
        items: [{ medicineId: 'med-01', medicineName: 'Dolo 650', quantity: 1, unitPrice: 30.0 }]
      };

      await expect(orderService.createBill(payload)).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it('should pass storeId to stock deductor to enforce store-level isolation', async () => {
      let passedStoreId = null;
      let passedMedicineId = null;
      let passedQty = null;

      orderService.setStockDeductor(async (medId, qty, storeId) => {
        passedMedicineId = medId;
        passedQty = qty;
        passedStoreId = storeId;
        return { success: true };
      });

      const payload = {
        storeId: 'store-002',
        customerName: 'Charlie',
        items: [{ medicineId: 'med-augmentin-625', medicineName: 'Augmentin', quantity: 3, unitPrice: 100.0 }]
      };

      const bill = await orderService.createBill(payload);
      expect(bill).toBeDefined();
      expect(bill.storeId).toBe('store-002');
      expect(passedStoreId).toBe('store-002');
      expect(passedMedicineId).toBe('med-augmentin-625');
      expect(passedQty).toBe(3);
    });

    it('should strictly use custom active storeId and never fallback to store-001', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));
      orderService.setStoreStatus('store-custom', 'ACTIVE');

      const bill = await orderService.createBill({
        storeId: 'store-custom',
        customerName: 'Kavita',
        items: [{ medicineId: 'med-01', medicineName: 'Dolo 650', quantity: 1, unitPrice: 30.0 }]
      });

      expect(bill.storeId).toBe('store-custom');
      expect(bill.storeId).not.toBe('store-001');
    });

    it('should return 409 and clean error message containing medicine name when stock deduction fails', async () => {
      orderService.setStockDeductor(async () => {
        const err = new Error('Available: 2, Requested: 5');
        err.statusCode = 409;
        throw err;
      });

      const payload = {
        storeId: 'store-001',
        items: [{ medicineId: 'med-low', medicineName: 'Amoxicillin 500mg', quantity: 5, unitPrice: 50.0 }]
      };

      await expect(orderService.createBill(payload)).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Amoxicillin 500mg/)
      });
    });
  });

  describe('Platform-Wide Sales Analytics', () => {
    beforeEach(async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      // Store 1: 2 bills
      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer 1',
        items: [
          { medicineId: 'med-dolo', medicineName: 'Dolo 650', quantity: 4, unitPrice: 30.0 }, // 120
          { medicineId: 'med-cetzine', medicineName: 'Cetzine 10', quantity: 2, unitPrice: 20.0 } // 40
        ]
      });

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer 2',
        items: [
          { medicineId: 'med-dolo', medicineName: 'Dolo 650', quantity: 6, unitPrice: 30.0 } // 180
        ]
      });

      // Store 2: 1 bill
      await orderService.createBill({
        storeId: 'store-002',
        customerName: 'Customer 3',
        items: [
          { medicineId: 'med-augmentin', medicineName: 'Augmentin 625', quantity: 5, unitPrice: 100.0 } // 500
        ]
      });
    });

    it('should calculate platform-wide analytics aggregating total stores, revenue, and top-selling medicines', async () => {
      const analytics = await orderService.getPlatformAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalStores).toBe(2);
      expect(analytics.totalBills).toBe(3);
      expect(analytics.totalRevenue).toBeGreaterThan(0);

      // Verify top-selling medicines: Dolo 650 (10 sold) should be #1
      expect(analytics.topSellingMedicines).toBeDefined();
      expect(analytics.topSellingMedicines.length).toBeGreaterThanOrEqual(3);
      expect(analytics.topSellingMedicines[0].medicineName).toBe('Dolo 650');
      expect(analytics.topSellingMedicines[0].quantitySold).toBe(10);

      // Verify store breakdown
      expect(analytics.storeBreakdown).toBeDefined();
      expect(analytics.storeBreakdown.length).toBe(2);
      const store1 = analytics.storeBreakdown.find((s) => s.storeId === 'store-001');
      expect(store1).toBeDefined();
      expect(store1.billCount).toBe(2);
    });
  });
});
