const pharmacyService = require('../../src/services/pharmacy.service');

describe('Medicine Service Unit Tests (Inventory Catalog & Stock)', () => {
  beforeEach(() => {
    pharmacyService.clear();
  });

  describe('addMedicine', () => {
    it('should successfully add a medicine with defaults and multi-tenant schema', async () => {
      const medicineData = {
        name: 'Paracetamol 650mg',
        genericName: 'Acetaminophen',
        category: 'Analgesics',
        batchNumber: 'BATCH-2026-001',
        expiryDate: '2028-12-31',
        price: 30.5,
        stockQuantity: 100,
        reorderLevel: 20,
        locationRack: 'Rack-A1'
      };

      const created = await pharmacyService.addMedicine(medicineData);

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.storeId).toBe('store-001'); // default storeId
      expect(created.name).toBe('Paracetamol 650mg');
      expect(created.genericName).toBe('Acetaminophen');
      expect(created.category).toBe('Analgesics');
      expect(created.batchNumber).toBe('BATCH-2026-001');
      expect(created.expiryDate).toBe('2028-12-31');
      expect(created.price).toBe(30.5);
      expect(created.stockQuantity).toBe(100);
      expect(created.reorderLevel).toBe(20);
      expect(created.inStock).toBe(true);
      expect(created.locationRack).toBe('Rack-A1');
      expect(created.createdAt).toBeDefined();
    });

    it('should support custom storeId and set inStock=false if stockQuantity is 0', async () => {
      const created = await pharmacyService.addMedicine({
        storeId: 'store-002',
        name: 'Amoxicillin 500mg',
        price: 45.0,
        stockQuantity: 0
      });

      expect(created.storeId).toBe('store-002');
      expect(created.inStock).toBe(false);
      expect(created.stockQuantity).toBe(0);
    });

    it('should throw an error if medicine name is missing or empty', async () => {
      await expect(
        pharmacyService.addMedicine({ price: 10, stockQuantity: 5 })
      ).rejects.toThrow('Medicine name is required');

      await expect(
        pharmacyService.addMedicine({ name: '   ', price: 10 })
      ).rejects.toThrow('Medicine name is required');
    });
  });

  describe('searchMedicines', () => {
    beforeEach(async () => {
      await pharmacyService.addMedicine({
        name: 'Azithromycin 500mg',
        genericName: 'Azithromycin',
        category: 'Antibiotics',
        price: 120.0,
        stockQuantity: 50,
        storeId: 'store-001'
      });

      await pharmacyService.addMedicine({
        name: 'Zithromax Suspension',
        genericName: 'Azithromycin',
        category: 'Antibiotics',
        price: 95.0,
        stockQuantity: 0,
        storeId: 'store-001'
      });

      await pharmacyService.addMedicine({
        name: 'Metformin 500mg',
        genericName: 'Metformin Hydrochloride',
        category: 'Antidiabetic',
        price: 25.0,
        stockQuantity: 200,
        storeId: 'store-002'
      });
    });

    it('should search medicines by name (case-insensitive substring)', async () => {
      const results = await pharmacyService.searchMedicines({ query: 'azithro' });
      expect(results).toHaveLength(2);
      expect(results.some((m) => m.name === 'Azithromycin 500mg')).toBe(true);
      expect(results.some((m) => m.name === 'Zithromax Suspension')).toBe(true);
    });

    it('should search medicines by genericName (case-insensitive substring)', async () => {
      const results = await pharmacyService.searchMedicines({ query: 'hydrochloride' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Metformin 500mg');
    });

    it('should filter search results by storeId', async () => {
      const results = await pharmacyService.searchMedicines({ query: 'azithro', storeId: 'store-001' });
      expect(results).toHaveLength(2);

      const emptyResults = await pharmacyService.searchMedicines({ query: 'azithro', storeId: 'store-002' });
      expect(emptyResults).toHaveLength(0);
    });

    it('should return all medicines if query is omitted or empty', async () => {
      const all = await pharmacyService.searchMedicines({});
      expect(all).toHaveLength(3);
    });

    it('should return real-time stockQuantity, inStock, and price for public view', async () => {
      const results = await pharmacyService.searchMedicines({ query: 'Zithromax' });
      expect(results).toHaveLength(1);
      expect(results[0].stockQuantity).toBe(0);
      expect(results[0].inStock).toBe(false);
      expect(results[0].price).toBe(95.0);
    });
  });

  describe('getMedicineById', () => {
    it('should return medicine by ID', async () => {
      const created = await pharmacyService.addMedicine({
        name: 'Cetirizine 10mg',
        price: 15.0,
        stockQuantity: 80
      });

      const found = await pharmacyService.getMedicineById(created.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Cetirizine 10mg');
    });

    it('should return null when ID is not found', async () => {
      const found = await pharmacyService.getMedicineById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('listMedicines', () => {
    beforeEach(async () => {
      await pharmacyService.addMedicine({
        name: 'Med A',
        category: 'Cardiology',
        storeId: 'store-001'
      });
      await pharmacyService.addMedicine({
        name: 'Med B',
        category: 'Cardiology',
        storeId: 'store-002'
      });
      await pharmacyService.addMedicine({
        name: 'Med C',
        category: 'Dermatology',
        storeId: 'store-001'
      });
    });

    it('should list all medicines when no filters applied', async () => {
      const list = await pharmacyService.listMedicines({});
      expect(list).toHaveLength(3);
    });

    it('should filter medicines by storeId', async () => {
      const list = await pharmacyService.listMedicines({ storeId: 'store-001' });
      expect(list).toHaveLength(2);
      expect(list.every((m) => m.storeId === 'store-001')).toBe(true);
    });

    it('should filter medicines by category (case-insensitive)', async () => {
      const list = await pharmacyService.listMedicines({ category: 'cardiology' });
      expect(list).toHaveLength(2);
    });

    it('should filter medicines by both storeId and category', async () => {
      const list = await pharmacyService.listMedicines({ storeId: 'store-001', category: 'Cardiology' });
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('Med A');
    });
  });

  describe('updateMedicine', () => {
    it('should update medicine fields and recalculate inStock flag', async () => {
      const created = await pharmacyService.addMedicine({
        name: 'Original Med',
        price: 50.0,
        stockQuantity: 10
      });

      const updated = await pharmacyService.updateMedicine(created.id, {
        price: 55.0,
        stockQuantity: 0,
        locationRack: 'Rack-B2'
      });

      expect(updated).toBeDefined();
      expect(updated.price).toBe(55.0);
      expect(updated.stockQuantity).toBe(0);
      expect(updated.inStock).toBe(false);
      expect(updated.locationRack).toBe('Rack-B2');
      expect(updated.name).toBe('Original Med');
    });

    it('should return null if medicine does not exist', async () => {
      const result = await pharmacyService.updateMedicine('non-existent', { price: 20 });
      expect(result).toBeNull();
    });
  });

  describe('adjustStock', () => {
    let medicine;

    beforeEach(async () => {
      medicine = await pharmacyService.addMedicine({
        name: 'Dolo 650mg',
        price: 30.0,
        stockQuantity: 20
      });
    });

    it('should RESTOCK: increment stock quantity and update inStock', async () => {
      const result = await pharmacyService.adjustStock(medicine.id, {
        action: 'RESTOCK',
        quantity: 15
      });

      expect(result.stockQuantity).toBe(35);
      expect(result.inStock).toBe(true);
    });

    it('should DEDUCT: decrement stock quantity when sufficient stock exists', async () => {
      const result = await pharmacyService.adjustStock(medicine.id, {
        action: 'DEDUCT',
        quantity: 5
      });

      expect(result.stockQuantity).toBe(15);
      expect(result.inStock).toBe(true);
    });

    it('should DEDUCT: set inStock=false when stock reaches 0', async () => {
      const result = await pharmacyService.adjustStock(medicine.id, {
        action: 'DEDUCT',
        quantity: 20
      });

      expect(result.stockQuantity).toBe(0);
      expect(result.inStock).toBe(false);
    });

    it('should DEDUCT: throw 409 Conflict when requested quantity exceeds available stock', async () => {
      await expect(
        pharmacyService.adjustStock(medicine.id, {
          action: 'DEDUCT',
          quantity: 25
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('Insufficient stock')
      });
    });

    it('should throw 400 when quantity is <= 0 or not an integer', async () => {
      await expect(
        pharmacyService.adjustStock(medicine.id, {
          action: 'DEDUCT',
          quantity: 0
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });

      await expect(
        pharmacyService.adjustStock(medicine.id, {
          action: 'RESTOCK',
          quantity: -5
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('should throw 400 when action is invalid', async () => {
      await expect(
        pharmacyService.adjustStock(medicine.id, {
          action: 'INVALID_ACTION',
          quantity: 5
        })
      ).rejects.toMatchObject({
        statusCode: 400
      });
    });

    it('should throw 404 when medicine does not exist', async () => {
      await expect(
        pharmacyService.adjustStock('unknown-id', {
          action: 'RESTOCK',
          quantity: 5
        })
      ).rejects.toMatchObject({
        statusCode: 404
      });
    });
  });
});
