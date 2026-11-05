const orderService = require('../../src/services/order.service');

describe('In-Store POS & Billing Unit Tests (order.service)', () => {
  beforeEach(() => {
    orderService.clear();
    orderService.resetStockDeductor();
  });

  describe('createBill', () => {
    it('should successfully create a bill with 5% GST and return receipt', async () => {
      // Mock stock deduction to succeed
      const deductedItems = [];
      orderService.setStockDeductor(async (medicineId, quantity) => {
        deductedItems.push({ medicineId, quantity });
        return { success: true, remainingStock: 50 };
      });

      const billData = {
        storeId: 'store-001',
        customerName: 'John Doe',
        customerPhone: '+1-555-4567',
        paymentMethod: 'CASH',
        items: [
          { medicineId: 'med-01', medicineName: 'Paracetamol 650mg', quantity: 2, unitPrice: 30.0 },
          { medicineId: 'med-02', medicineName: 'Cetirizine 10mg', quantity: 1, unitPrice: 40.0 }
        ],
        discountAmount: 10.0
      };

      const bill = await orderService.createBill(billData);

      expect(bill).toBeDefined();
      expect(bill.billId).toMatch(/^BILL-/);
      expect(bill.status).toBe('PAID');
      expect(bill.storeId).toBe('store-001');
      expect(bill.customerName).toBe('John Doe');
      expect(bill.customerPhone).toBe('+1-555-4567');
      expect(bill.paymentMethod).toBe('CASH');
      expect(bill.items).toHaveLength(2);

      // Subtotal: (2 * 30) + (1 * 40) = 100.00
      expect(bill.subtotal).toBe(100.0);
      expect(bill.discountAmount).toBe(10.0);
      // Taxable: 100 - 10 = 90.00; Tax (5% GST): 4.50
      expect(bill.taxAmount).toBe(4.5);
      // Final Total: 90 + 4.5 = 94.50
      expect(bill.finalTotal).toBe(94.5);
      expect(bill.createdAt).toBeDefined();

      // Verify stock was deducted for both items
      expect(deductedItems).toHaveLength(2);
      expect(deductedItems[0]).toEqual({ medicineId: 'med-01', quantity: 2 });
      expect(deductedItems[1]).toEqual({ medicineId: 'med-02', quantity: 1 });
    });

    it('should default storeId, customerName, and paymentMethod when omitted', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      const bill = await orderService.createBill({
        items: [
          { medicineId: 'med-01', medicineName: 'Aspirin', quantity: 1, unitPrice: 20.0 }
        ]
      });

      expect(bill.storeId).toBe('store-001');
      expect(bill.customerName).toBe('Walk-in Customer');
      expect(bill.paymentMethod).toBe('CASH');
      expect(bill.discountAmount).toBe(0);
      expect(bill.subtotal).toBe(20.0);
      // 5% GST on 20 = 1.00; final = 21.00
      expect(bill.taxAmount).toBe(1.0);
      expect(bill.finalTotal).toBe(21.0);
      expect(bill.status).toBe('PAID');
    });

    it('should throw 409 Conflict if stock deduction fails due to insufficient stock', async () => {
      orderService.setStockDeductor(async (medicineId, quantity) => {
        const error = new Error(`Insufficient stock for medicine ${medicineId}`);
        error.statusCode = 409;
        throw error;
      });

      await expect(
        orderService.createBill({
          items: [
            { medicineId: 'med-out', medicineName: 'Rare Med', quantity: 100, unitPrice: 50.0 }
          ]
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('Insufficient stock')
      });
    });

    it('should throw 400 Bad Request if items array is missing or empty', async () => {
      await expect(
        orderService.createBill({ items: [] })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      await expect(
        orderService.createBill({})
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('should throw 400 Bad Request if item is missing medicineId or has invalid quantity', async () => {
      await expect(
        orderService.createBill({
          items: [{ medicineName: 'Med', quantity: 2, unitPrice: 10 }]
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      await expect(
        orderService.createBill({
          items: [{ medicineId: 'm1', quantity: 0, unitPrice: 10 }]
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      await expect(
        orderService.createBill({
          items: [{ medicineId: 'm1', quantity: -1, unitPrice: 10 }]
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });
  });

  describe('getBillById', () => {
    it('should retrieve persisted bill details by billId', async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      const created = await orderService.createBill({
        customerName: 'Alice',
        items: [{ medicineId: 'm1', quantity: 2, unitPrice: 15.0 }]
      });

      const retrieved = await orderService.getBillById(created.billId);
      expect(retrieved).toBeDefined();
      expect(retrieved.billId).toBe(created.billId);
      expect(retrieved.customerName).toBe('Alice');
      expect(retrieved.status).toBe('PAID');
    });

    it('should return null when billId does not exist', async () => {
      const retrieved = await orderService.getBillById('NON-EXISTENT-BILL');
      expect(retrieved).toBeNull();
    });
  });

  describe('listBills', () => {
    beforeEach(async () => {
      orderService.setStockDeductor(async () => ({ success: true }));

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer 1',
        items: [{ medicineId: 'm1', quantity: 1, unitPrice: 100.0 }] // subtotal 100, tax 5, total 105
      });

      await orderService.createBill({
        storeId: 'store-001',
        customerName: 'Customer 2',
        items: [{ medicineId: 'm2', quantity: 2, unitPrice: 50.0 }] // subtotal 100, tax 5, total 105
      });

      await orderService.createBill({
        storeId: 'store-002',
        customerName: 'Customer 3',
        items: [{ medicineId: 'm3', quantity: 1, unitPrice: 200.0 }] // subtotal 200, tax 10, total 210
      });
    });

    it('should list all bills with aggregate revenue when no storeId filter is specified', async () => {
      const result = await orderService.listBills({});

      expect(result.bills).toHaveLength(3);
      expect(result.count).toBe(3);
      // Total revenue: 105 + 105 + 210 = 420.00
      expect(result.totalRevenue).toBe(420.0);
    });

    it('should filter bills by storeId and calculate store-specific total revenue', async () => {
      const result = await orderService.listBills({ storeId: 'store-001' });

      expect(result.bills).toHaveLength(2);
      expect(result.count).toBe(2);
      // Total revenue for store-001: 105 + 105 = 210.00
      expect(result.totalRevenue).toBe(210.0);
      expect(result.bills.every((b) => b.storeId === 'store-001')).toBe(true);
    });
  });
});
