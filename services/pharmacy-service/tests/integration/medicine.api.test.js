const request = require('supertest');
const app = require('../../src/app');
const pharmacyService = require('../../src/services/pharmacy.service');

describe('Medicine Inventory & Catalog API Integration Tests', () => {
  beforeEach(() => {
    pharmacyService.clear();
  });

  describe('POST /api/v1/medicines', () => {
    it('should create a medicine and return 201 Created', async () => {
      const payload = {
        name: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        category: 'Antibiotics',
        batchNumber: 'AMX-2026-99',
        expiryDate: '2027-05-31',
        price: 45.0,
        stockQuantity: 150,
        reorderLevel: 30,
        locationRack: 'Rack-C4'
      };

      const res = await request(app)
        .post('/api/v1/medicines')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.storeId).toBe('store-001');
      expect(res.body.data.name).toBe('Amoxicillin 500mg');
      expect(res.body.data.price).toBe(45.0);
      expect(res.body.data.stockQuantity).toBe(150);
      expect(res.body.data.inStock).toBe(true);
    });

    it('should return 400 when medicine name is missing', async () => {
      const payload = {
        price: 50.0,
        stockQuantity: 10
      };

      const res = await request(app)
        .post('/api/v1/medicines')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('name');
    });
  });

  describe('GET /api/v1/medicines/search', () => {
    beforeEach(async () => {
      await pharmacyService.addMedicine({
        name: 'Paracetamol 500mg',
        genericName: 'Acetaminophen',
        category: 'Pain Relief',
        price: 20.0,
        stockQuantity: 50,
        storeId: 'store-001'
      });
      await pharmacyService.addMedicine({
        name: 'Ibuprofen 400mg',
        genericName: 'Ibuprofen',
        category: 'Pain Relief',
        price: 35.0,
        stockQuantity: 0,
        storeId: 'store-001'
      });
    });

    it('should perform public search and return real-time stock and pricing', async () => {
      const res = await request(app)
        .get('/api/v1/medicines/search')
        .query({ query: 'paracetamol' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Paracetamol 500mg');
      expect(res.body.data[0].stockQuantity).toBe(50);
      expect(res.body.data[0].inStock).toBe(true);
      expect(res.body.data[0].price).toBe(20.0);
    });

    it('should search by genericName through query parameter q', async () => {
      const res = await request(app)
        .get('/api/v1/medicines/search')
        .query({ q: 'acetaminophen' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Paracetamol 500mg');
    });

    it('should return empty list when no medicine matches query', async () => {
      const res = await request(app)
        .get('/api/v1/medicines/search')
        .query({ query: 'NonExistentMedicine' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/v1/medicines', () => {
    beforeEach(async () => {
      await pharmacyService.addMedicine({
        name: 'Omeprazole 20mg',
        category: 'Gastrointestinal',
        storeId: 'store-001'
      });
      await pharmacyService.addMedicine({
        name: 'Pantoprazole 40mg',
        category: 'Gastrointestinal',
        storeId: 'store-002'
      });
    });

    it('should list all medicines', async () => {
      const res = await request(app).get('/api/v1/medicines');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
    });

    it('should filter by storeId', async () => {
      const res = await request(app)
        .get('/api/v1/medicines')
        .query({ storeId: 'store-001' });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Omeprazole 20mg');
    });
  });

  describe('GET /api/v1/medicines/:id', () => {
    it('should fetch single medicine by id', async () => {
      const created = await pharmacyService.addMedicine({
        name: 'Aspirin 75mg',
        price: 15.0,
        stockQuantity: 100
      });

      const res = await request(app).get(`/api/v1/medicines/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(created.id);
      expect(res.body.data.name).toBe('Aspirin 75mg');
    });

    it('should return 404 when medicine does not exist', async () => {
      const res = await request(app).get('/api/v1/medicines/unknown-medicine-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('PUT /api/v1/medicines/:id', () => {
    it('should update medicine details and recalculate inStock', async () => {
      const created = await pharmacyService.addMedicine({
        name: 'Original Name',
        price: 20.0,
        stockQuantity: 5
      });

      const res = await request(app)
        .put(`/api/v1/medicines/${created.id}`)
        .send({
          name: 'Updated Name',
          price: 25.0,
          stockQuantity: 0
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.price).toBe(25.0);
      expect(res.body.data.stockQuantity).toBe(0);
      expect(res.body.data.inStock).toBe(false);
    });

    it('should return 404 when updating non-existent medicine', async () => {
      const res = await request(app)
        .put('/api/v1/medicines/unknown-id')
        .send({ price: 30.0 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/medicines/:id/stock', () => {
    let medicine;

    beforeEach(async () => {
      medicine = await pharmacyService.addMedicine({
        name: 'Insulin Glargine',
        price: 450.0,
        stockQuantity: 10
      });
    });

    it('should DEDUCT stock successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/medicines/${medicine.id}/stock`)
        .send({ action: 'DEDUCT', quantity: 4 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stockQuantity).toBe(6);
      expect(res.body.data.inStock).toBe(true);
    });

    it('should return 409 Conflict when stock is insufficient for DEDUCT', async () => {
      const res = await request(app)
        .patch(`/api/v1/medicines/${medicine.id}/stock`)
        .send({ action: 'DEDUCT', quantity: 20 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Insufficient stock');
    });

    it('should RESTOCK stock successfully', async () => {
      const res = await request(app)
        .patch(`/api/v1/medicines/${medicine.id}/stock`)
        .send({ action: 'RESTOCK', quantity: 15 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stockQuantity).toBe(25);
      expect(res.body.data.inStock).toBe(true);
    });

    it('should return 400 for invalid action or quantity', async () => {
      const res1 = await request(app)
        .patch(`/api/v1/medicines/${medicine.id}/stock`)
        .send({ action: 'UNKNOWN', quantity: 5 });

      expect(res1.status).toBe(400);

      const res2 = await request(app)
        .patch(`/api/v1/medicines/${medicine.id}/stock`)
        .send({ action: 'RESTOCK', quantity: -2 });

      expect(res2.status).toBe(400);
    });

    it('should return 404 when medicine does not exist', async () => {
      const res = await request(app)
        .patch('/api/v1/medicines/unknown-med/stock')
        .send({ action: 'RESTOCK', quantity: 10 });

      expect(res.status).toBe(404);
    });
  });
});
