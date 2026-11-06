const request = require('supertest');
const app = require('../../src/app');
const pharmacyService = require('../../src/services/pharmacy.service');

describe('Multi-Tenant Pharmacy API Integration Tests', () => {
  beforeEach(() => {
    pharmacyService.resetToSeed();
  });

  describe('Store & Super Admin Authentication', () => {
    it('POST /api/v1/auth/store/login: should successfully log in an ACTIVE store', async () => {
      const res = await request(app)
        .post('/api/v1/auth/store/login')
        .send({
          email: 'apollo.indiranagar@medigrid.com',
          password: 'store123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.store).toMatchObject({
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
      expect(res.body.store.password).toBeUndefined();
    });

    it('POST /api/v1/auth/store/login: should reject a SUSPENDED store with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/store/login')
        .send({
          email: 'lifecare.hsr@medigrid.com',
          password: 'store123'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('suspended');
    });

    it('POST /api/v1/auth/store/login: should return 401 for wrong credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/store/login')
        .send({
          email: 'apollo.indiranagar@medigrid.com',
          password: 'wrong'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/v1/auth/admin/login: should successfully authenticate super admin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@medigrid.com',
          password: 'admin123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.admin).toEqual({
        email: 'admin@medigrid.com',
        role: 'SUPER_ADMIN'
      });
    });

    it('POST /api/v1/auth/admin/login: should return 401 for wrong admin credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/admin/login')
        .send({
          email: 'admin@medigrid.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Public Location-Based Medicine Discovery API', () => {
    it('GET /api/v1/public/search: should return nearby medicines sorted by proximity', async () => {
      const res = await request(app)
        .get('/api/v1/public/search')
        .query({
          medicine: 'Dolo 650',
          lat: 12.9784,
          lng: 77.6408,
          radius: 15
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(2);

      // Verify sorting: closest first
      expect(res.body.data[0].storeId).toBe('store-001');
      expect(res.body.data[0].distanceKm).toBe(0);
      expect(res.body.data[1].storeId).toBe('store-002');
      expect(res.body.data[1].distanceKm).toBeGreaterThan(0);
    });

    it('GET /api/v1/public/search: should NEVER return medicines from SUSPENDED stores', async () => {
      const res = await request(app)
        .get('/api/v1/public/search')
        .query({
          medicine: 'Dolo 650',
          lat: 12.9784,
          lng: 77.6408,
          radius: 30
        });

      expect(res.status).toBe(200);
      const suspendedResults = res.body.data.filter((item) => item.storeId === 'store-003');
      expect(suspendedResults).toHaveLength(0);
    });

    it('GET /api/v1/public/search: should enforce privacy & strict field masking', async () => {
      const res = await request(app)
        .get('/api/v1/public/search')
        .query({
          medicine: 'Dolo 650',
          lat: 12.9784,
          lng: 77.6408
        });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);

      for (const item of res.body.data) {
        // Must contain customer-facing fields
        expect(item.storeId).toBeDefined();
        expect(item.storeName).toBeDefined();
        expect(item.storeAddress).toBeDefined();
        expect(item.storePhone).toBeDefined();
        expect(item.medicineName).toBeDefined();
        expect(item.genericName).toBeDefined();
        expect(item.price).toBeDefined();
        expect(item.stockStatus).toBeDefined();
        expect(typeof item.inStock).toBe('boolean');

        // MUST NEVER return internal confidential data
        expect(item.batchNumber).toBeUndefined();
        expect(item.locationRack).toBeUndefined();
        expect(item.rack).toBeUndefined();
        expect(item.cost).toBeUndefined();
        expect(item.wholesaleCost).toBeUndefined();
        expect(item.supplierNotes).toBeUndefined();
      }
    });

    it('GET /api/v1/public/search: should support city query filtering', async () => {
      const res = await request(app)
        .get('/api/v1/public/search')
        .query({
          medicine: 'Augmentin',
          city: 'Bangalore'
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
    });
  });

  describe('Super Admin Management APIs', () => {
    it('GET /api/v1/admin/stores: should list registered medical stores with filtering and search', async () => {
      const resAll = await request(app).get('/api/v1/admin/stores');
      expect(resAll.status).toBe(200);
      expect(resAll.body.count).toBeGreaterThanOrEqual(3);

      const resActive = await request(app)
        .get('/api/v1/admin/stores')
        .query({ status: 'ACTIVE' });
      expect(resActive.status).toBe(200);
      expect(resActive.body.data.every((s) => s.status === 'ACTIVE')).toBe(true);

      const resSuspended = await request(app)
        .get('/api/v1/admin/stores')
        .query({ status: 'SUSPENDED' });
      expect(resSuspended.status).toBe(200);
      expect(resSuspended.body.data.every((s) => s.status === 'SUSPENDED')).toBe(true);

      const resSearch = await request(app)
        .get('/api/v1/admin/stores')
        .query({ search: 'Koramangala' });
      expect(resSearch.status).toBe(200);
      expect(resSearch.body.count).toBe(1);
      expect(resSearch.body.data[0].id).toBe('store-002');
    });

    it('POST /api/v1/admin/stores: should onboard a new medical store', async () => {
      const payload = {
        name: 'Fortis Health Chemist',
        licenseNumber: 'KA-BLR-2023-999',
        address: 'Bannerghatta Rd',
        city: 'Bangalore',
        phone: '+91-9988776655',
        email: 'fortis.bg@medigrid.com',
        password: 'password123',
        coordinates: { lat: 12.8988, lng: 77.5996 }
      };

      const res = await request(app)
        .post('/api/v1/admin/stores')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Fortis Health Chemist');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.password).toBeUndefined(); // Never leak password in response
    });

    it('PATCH /api/v1/admin/stores/:id/status: should suspend and reactivate a store', async () => {
      // Suspend store-001
      const resSuspend = await request(app)
        .patch('/api/v1/admin/stores/store-001/status')
        .send({ status: 'SUSPENDED' });

      expect(resSuspend.status).toBe(200);
      expect(resSuspend.body.success).toBe(true);
      expect(resSuspend.body.data.status).toBe('SUSPENDED');

      // Verify store login now fails with 403
      const loginRes = await request(app)
        .post('/api/v1/auth/store/login')
        .send({
          email: 'apollo.indiranagar@medigrid.com',
          password: 'store123'
        });
      expect(loginRes.status).toBe(403);

      // Reactivate store-001
      const resReactivate = await request(app)
        .patch('/api/v1/admin/stores/store-001/status')
        .send({ status: 'ACTIVE' });

      expect(resReactivate.status).toBe(200);
      expect(resReactivate.body.data.status).toBe('ACTIVE');
    });

    it('DELETE /api/v1/admin/stores/:id: should delete a store', async () => {
      const res = await request(app).delete('/api/v1/admin/stores/store-003');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkRes = await request(app).get('/api/v1/admin/stores');
      expect(checkRes.body.data.some((s) => s.id === 'store-003')).toBe(false);
    });
  });

  describe('Tenant-Isolated Inventory APIs', () => {
    it('GET /api/v1/medicines?storeId=...: should return inventory strictly for that store', async () => {
      const res1 = await request(app)
        .get('/api/v1/medicines')
        .query({ storeId: 'store-001' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.every((m) => m.storeId === 'store-001')).toBe(true);

      const res2 = await request(app)
        .get('/api/v1/medicines')
        .query({ storeId: 'store-002' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.every((m) => m.storeId === 'store-002')).toBe(true);
    });

    it('POST /api/v1/medicines: should add medicine scoped to specified storeId', async () => {
      const res = await request(app)
        .post('/api/v1/medicines')
        .send({
          name: 'Azithromycin 500mg',
          storeId: 'store-002',
          price: 90.0,
          stockQuantity: 40
        });

      expect(res.status).toBe(201);
      expect(res.body.data.storeId).toBe('store-002');
      expect(res.body.data.name).toBe('Azithromycin 500mg');
    });

    it('PATCH /api/v1/medicines/:id/stock: should scope stock adjustment to storeId', async () => {
      const medsRes = await request(app)
        .get('/api/v1/medicines')
        .query({ storeId: 'store-001' });

      const med = medsRes.body.data[0];

      // Try adjusting stock under wrong storeId -> 403
      const failRes = await request(app)
        .patch(`/api/v1/medicines/${med.id}/stock`)
        .send({ action: 'DEDUCT', quantity: 1, storeId: 'store-002' });

      expect(failRes.status).toBe(403);

      // Adjust stock with correct storeId -> 200
      const okRes = await request(app)
        .patch(`/api/v1/medicines/${med.id}/stock`)
        .send({ action: 'DEDUCT', quantity: 2, storeId: 'store-001' });

      expect(okRes.status).toBe(200);
      expect(okRes.body.data.stockQuantity).toBe(med.stockQuantity - 2);
    });
  });
});
