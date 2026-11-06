const pharmacyService = require('../../src/services/pharmacy.service');

describe('Multi-Tenant Store & Public Discovery Unit Tests (pharmacy.service)', () => {
  beforeEach(() => {
    pharmacyService.resetToSeed();
  });

  describe('Pre-seeded Stores and Medicines', () => {
    it('should pre-seed 3 medical stores with correct statuses and coordinates', async () => {
      const stores = await pharmacyService.listStores();
      expect(stores.length).toBeGreaterThanOrEqual(3);

      const store1 = await pharmacyService.getStoreById('store-001');
      expect(store1).toBeDefined();
      expect(store1.name).toContain('Apollo Pharmacy');
      expect(store1.status).toBe('ACTIVE');
      expect(store1.coordinates).toEqual({ lat: 12.9784, lng: 77.6408 });

      const store2 = await pharmacyService.getStoreById('store-002');
      expect(store2).toBeDefined();
      expect(store2.name).toContain('MedPlus Chemist');
      expect(store2.status).toBe('ACTIVE');
      expect(store2.coordinates).toEqual({ lat: 12.9352, lng: 77.6245 });

      const store3 = await pharmacyService.getStoreById('store-003');
      expect(store3).toBeDefined();
      expect(store3.name).toContain('Lifecare Pharmacy');
      expect(store3.status).toBe('SUSPENDED');
      expect(store3.coordinates).toEqual({ lat: 12.9121, lng: 77.6446 });
    });

    it('should have medicines assigned to store-001 and store-002', async () => {
      const store1Meds = await pharmacyService.listMedicines({ storeId: 'store-001' });
      const store2Meds = await pharmacyService.listMedicines({ storeId: 'store-002' });

      expect(store1Meds.length).toBeGreaterThan(0);
      expect(store2Meds.length).toBeGreaterThan(0);

      expect(store1Meds.some((m) => m.name.includes('Dolo 650'))).toBe(true);
      expect(store2Meds.some((m) => m.name.includes('Dolo 650'))).toBe(true);
    });
  });

  describe('Authentication & Tenant Scoping', () => {
    it('should authenticate active store with valid credentials and return all sanitized store details', async () => {
      const auth = await pharmacyService.loginStore('apollo.indiranagar@medigrid.com', 'store123');
      expect(auth).toBeDefined();
      expect(auth.token).toBeDefined();
      expect(auth.store).toMatchObject({
        id: 'store-001',
        name: 'Apollo Pharmacy - Indiranagar',
        email: 'apollo.indiranagar@medigrid.com',
        licenseNumber: 'KA-BLR-2023-001',
        address: '100 Ft Rd, Indiranagar',
        city: 'Bangalore',
        phone: '+91-9876543210',
        coordinates: { lat: 12.9784, lng: 77.6408 },
        status: 'ACTIVE'
      });
      expect(auth.store.password).toBeUndefined();
    });

    it('should reject login with 403 if store is SUSPENDED', async () => {
      await expect(
        pharmacyService.loginStore('lifecare.hsr@medigrid.com', 'store123')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('suspended')
      });
    });

    it('should reject login with 401 for invalid credentials', async () => {
      await expect(
        pharmacyService.loginStore('apollo.indiranagar@medigrid.com', 'wrongpassword')
      ).rejects.toMatchObject({
        statusCode: 401
      });

      await expect(
        pharmacyService.loginStore('unknown@medigrid.com', 'store123')
      ).rejects.toMatchObject({
        statusCode: 401
      });
    });

    it('should authenticate super admin with admin@medigrid.com / admin123', async () => {
      const adminAuth = await pharmacyService.loginAdmin('admin@medigrid.com', 'admin123');
      expect(adminAuth).toBeDefined();
      expect(adminAuth.token).toBeDefined();
      expect(adminAuth.admin.email).toBe('admin@medigrid.com');
      expect(adminAuth.admin.role).toBe('SUPER_ADMIN');
    });

    it('should reject super admin login with invalid password', async () => {
      await expect(
        pharmacyService.loginAdmin('admin@medigrid.com', 'wrongadmin')
      ).rejects.toMatchObject({
        statusCode: 401
      });
    });
  });

  describe('Public Location-Based Medicine Discovery', () => {
    it('should find medicine across active stores sorted by proximity', async () => {
      // Search from Indiranagar coordinates (12.9784, 77.6408)
      const results = await pharmacyService.publicSearchMedicines({
        medicine: 'Dolo 650',
        lat: 12.9784,
        lng: 77.6408,
        radius: 15
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      // store-001 (0 km away) should come before store-002 (~5 km away)
      expect(results[0].storeId).toBe('store-001');
      expect(results[0].distanceKm).toBe(0);
      expect(results[1].storeId).toBe('store-002');
      expect(results[1].distanceKm).toBeGreaterThan(0);
    });

    it('should NEVER return medicines from SUSPENDED stores', async () => {
      const results = await pharmacyService.publicSearchMedicines({
        medicine: 'Dolo 650',
        lat: 12.9784,
        lng: 77.6408,
        radius: 25
      });

      const hasSuspended = results.some((r) => r.storeId === 'store-003');
      expect(hasSuspended).toBe(false);
    });

    it('should mask internal confidential fields (privacy & strict security)', async () => {
      const results = await pharmacyService.publicSearchMedicines({
        medicine: 'Dolo 650',
        lat: 12.9784,
        lng: 77.6408,
        radius: 15
      });

      expect(results.length).toBeGreaterThan(0);
      for (const item of results) {
        // Assert required public customer fields exist
        expect(item.storeId).toBeDefined();
        expect(item.storeName).toBeDefined();
        expect(item.storeAddress).toBeDefined();
        expect(item.storePhone).toBeDefined();
        expect(item.medicineName).toBeDefined();
        expect(item.genericName).toBeDefined();
        expect(item.price).toBeDefined();
        expect(item.stockStatus).toBeDefined();
        expect(typeof item.inStock).toBe('boolean');

        // Assert strictly NEVER return confidential data
        expect(item.batchNumber).toBeUndefined();
        expect(item.locationRack).toBeUndefined();
        expect(item.rack).toBeUndefined();
        expect(item.cost).toBeUndefined();
        expect(item.wholesaleCost).toBeUndefined();
        expect(item.supplierNotes).toBeUndefined();
        expect(item.supplier).toBeUndefined();
      }
    });

    it('should filter by city when provided', async () => {
      const results = await pharmacyService.publicSearchMedicines({
        medicine: 'Dolo 650',
        city: 'Bangalore'
      });

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.storeId).not.toBe('store-003');
      }
    });
  });

  describe('Super Admin Store Management', () => {
    it('should list all stores and filter by status and search', async () => {
      const activeStores = await pharmacyService.listStores({ status: 'ACTIVE' });
      expect(activeStores.every((s) => s.status === 'ACTIVE')).toBe(true);

      const suspendedStores = await pharmacyService.listStores({ status: 'SUSPENDED' });
      expect(suspendedStores.every((s) => s.status === 'SUSPENDED')).toBe(true);
      expect(suspendedStores.some((s) => s.id === 'store-003')).toBe(true);

      const searchedStores = await pharmacyService.listStores({ search: 'Indiranagar' });
      expect(searchedStores.length).toBe(1);
      expect(searchedStores[0].id).toBe('store-001');
    });

    it('should onboard a new medical store', async () => {
      const newStore = await pharmacyService.registerStore({
        name: 'Apollo Pharmacy - Whitefield',
        licenseNumber: 'KA-BLR-2023-004',
        address: 'ITPL Main Rd, Whitefield',
        city: 'Bangalore',
        phone: '+91-9876543299',
        email: 'apollo.whitefield@medigrid.com',
        password: 'password123',
        coordinates: { lat: 12.9698, lng: 77.7499 }
      });

      expect(newStore).toBeDefined();
      expect(newStore.id).toBeDefined();
      expect(newStore.status).toBe('ACTIVE');

      const fetched = await pharmacyService.getStoreById(newStore.id);
      expect(fetched.name).toBe('Apollo Pharmacy - Whitefield');
    });

    it('should update store status to SUSPENDED and reactivate to ACTIVE', async () => {
      const suspended = await pharmacyService.updateStoreStatus('store-001', 'SUSPENDED');
      expect(suspended.status).toBe('SUSPENDED');

      // Now login should be rejected with 403
      await expect(
        pharmacyService.loginStore('apollo.indiranagar@medigrid.com', 'store123')
      ).rejects.toMatchObject({ statusCode: 403 });

      // Reactivate store
      const reactivated = await pharmacyService.updateStoreStatus('store-001', 'ACTIVE');
      expect(reactivated.status).toBe('ACTIVE');

      // Now login should succeed
      const auth = await pharmacyService.loginStore('apollo.indiranagar@medigrid.com', 'store123');
      expect(auth.store.status).toBe('ACTIVE');
    });

    it('should delete a store', async () => {
      const res = await pharmacyService.deleteStore('store-003');
      expect(res).toBe(true);

      const fetched = await pharmacyService.getStoreById('store-003');
      expect(fetched).toBeNull();
    });

    it('should preserve custom city and not hardcode Bangalore when onboarding a store', async () => {
      const newStore = await pharmacyService.registerStore({
        name: 'Apollo Pharmacy - Mumbai Central',
        licenseNumber: 'MH-MUM-2026-101',
        address: 'Dr D.B. Marg, Mumbai Central',
        city: 'Mumbai',
        phone: '+91-9876543200',
        email: 'apollo.mumbai@medigrid.com',
        password: 'password123',
        coordinates: { lat: 18.9696, lng: 72.8193 }
      });

      expect(newStore.city).toBe('Mumbai');
      expect(newStore.licenseNumber).toBe('MH-MUM-2026-101');
      expect(newStore.address).toBe('Dr D.B. Marg, Mumbai Central');
      expect(newStore.phone).toBe('+91-9876543200');
      expect(newStore.coordinates).toEqual({ lat: 18.9696, lng: 72.8193 });
    });

    it('should ensure getStoreById and _sanitizeStore retain all critical store properties', async () => {
      const store = await pharmacyService.getStoreById('store-001');
      expect(store).toBeDefined();
      expect(store.licenseNumber).toBe('KA-BLR-2023-001');
      expect(store.city).toBe('Bangalore');
      expect(store.address).toBe('100 Ft Rd, Indiranagar');
      expect(store.phone).toBe('+91-9876543210');
      expect(store.coordinates).toEqual({ lat: 12.9784, lng: 77.6408 });
      expect(store.password).toBeUndefined();
    });
  });

  describe('Tenant-Isolated Stock Adjustment', () => {
    it('should reject stock adjustment when storeId does not match medicine storeId', async () => {
      const store1Meds = await pharmacyService.listMedicines({ storeId: 'store-001' });
      const med = store1Meds[0];

      await expect(
        pharmacyService.adjustStock(med.id, { action: 'DEDUCT', quantity: 1, storeId: 'store-002' })
      ).rejects.toMatchObject({
        statusCode: 403
      });
    });

    it('should allow stock adjustment when storeId matches medicine storeId', async () => {
      const store1Meds = await pharmacyService.listMedicines({ storeId: 'store-001' });
      const med = store1Meds[0];
      const initialStock = med.stockQuantity;

      const updated = await pharmacyService.adjustStock(med.id, {
        action: 'DEDUCT',
        quantity: 2,
        storeId: 'store-001'
      });

      expect(updated.stockQuantity).toBe(initialStock - 2);
    });
  });
});
