const request = require('supertest');
const app = require('../../src/app');
const pharmacyService = require('../../src/services/pharmacy.service');

describe('Pharmacy API Integration Tests', () => {
  beforeEach(() => {
    pharmacyService.clear();
  });

  describe('POST /api/v1/pharmacies', () => {
    it('should create a pharmacy successfully and return 201', async () => {
      const payload = {
        name: 'HealthPlus Pharmacy',
        address: '100 Main St, Metropolis',
        phone: '+1-555-123-4567',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.006
        },
        inventory: [
          { name: 'Amoxicillin', dosage: '500mg', quantity: 25, price: 15.5 },
          { name: 'Ibuprofen', dosage: '200mg', quantity: 100, price: 8.99 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/pharmacies')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('HealthPlus Pharmacy');
      expect(res.body.data.coordinates).toEqual({ latitude: 40.7128, longitude: -74.006 });
      expect(res.body.data.inventory).toHaveLength(2);
    });

    it('should support flat lat and lng coordinates in request payload', async () => {
      const payload = {
        name: 'Corner Drugstore',
        address: '200 Elm St',
        lat: 40.73,
        lng: -73.99
      };

      const res = await request(app)
        .post('/api/v1/pharmacies')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.coordinates.latitude).toBe(40.73);
      expect(res.body.data.coordinates.longitude).toBe(-73.99);
    });

    it('should return 400 when name is missing', async () => {
      const payload = {
        address: '200 Elm St',
        coordinates: { latitude: 40.73, longitude: -73.99 }
      };

      const res = await request(app)
        .post('/api/v1/pharmacies')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('name');
    });

    it('should return 400 when coordinates are missing or invalid', async () => {
      const payload = {
        name: 'Invalid Coordinates Pharmacy',
        coordinates: { latitude: 95, longitude: -73.99 }
      };

      const res = await request(app)
        .post('/api/v1/pharmacies')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/pharmacies/nearby', () => {
    beforeEach(async () => {
      // Pharmacy 1: ~1 km from search center (40.7128, -74.0060)
      await pharmacyService.registerPharmacy({
        name: 'Downtown Meds',
        address: '1 Broad St',
        coordinates: { latitude: 40.713, longitude: -74.007 },
        inventory: [
          { name: 'Metformin', dosage: '500mg', quantity: 50, price: 10.0 },
          { name: 'Aspirin', dosage: '100mg', quantity: 0, price: 4.5 }
        ]
      });

      // Pharmacy 2: ~4 km from search center
      await pharmacyService.registerPharmacy({
        name: 'Midtown Care',
        address: '400 5th Ave',
        coordinates: { latitude: 40.748, longitude: -73.985 },
        inventory: [
          { name: 'Metformin', dosage: '500mg', quantity: 15, price: 11.0 },
          { name: 'Aspirin', dosage: '100mg', quantity: 80, price: 5.0 }
        ]
      });

      // Pharmacy 3: ~15 km away
      await pharmacyService.registerPharmacy({
        name: 'Distant Pharmacy',
        address: '1000 Distant Rd',
        coordinates: { latitude: 40.85, longitude: -73.9 },
        inventory: [
          { name: 'Metformin', dosage: '500mg', quantity: 100, price: 9.0 }
        ]
      });
    });

    it('should return 400 when coordinates are missing', async () => {
      const res = await request(app).get('/api/v1/pharmacies/nearby');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return pharmacies within default radius (5 km)', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacies/nearby')
        .query({ lat: 40.7128, lng: -74.006 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data[0].name).toBe('Downtown Meds');
      expect(res.body.data[1].name).toBe('Midtown Care');
      expect(res.body.data[0].distanceKm).toBeLessThan(res.body.data[1].distanceKm);
    });

    it('should return all pharmacies when expanding radius', async () => {
      const res = await request(app)
        .get('/api/v1/pharmacies/nearby')
        .query({ lat: 40.7128, lng: -74.006, radius: 20 });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('should filter pharmacies by medicine name and verify stock availability', async () => {
      // Aspirin is in stock at Midtown Care (qty 80), out of stock at Downtown Meds (qty 0)
      const res = await request(app)
        .get('/api/v1/pharmacies/nearby')
        .query({
          latitude: 40.7128,
          longitude: -74.006,
          radius: 10,
          medicine: 'aspirin'
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Midtown Care');
      expect(res.body.data[0].matchingMedicine.name).toBe('Aspirin');
      expect(res.body.data[0].matchingMedicine.quantity).toBe(80);
    });
  });

  describe('GET /api/v1/pharmacies/:id', () => {
    it('should return pharmacy by ID', async () => {
      const created = await pharmacyService.registerPharmacy({
        name: 'Single Pharmacy Test',
        address: '123 Search Ave',
        coordinates: { latitude: 40.7, longitude: -74.0 }
      });

      const res = await request(app).get(`/api/v1/pharmacies/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(created.id);
      expect(res.body.data.name).toBe('Single Pharmacy Test');
    });

    it('should return 404 if pharmacy is not found', async () => {
      const res = await request(app).get('/api/v1/pharmacies/non-existent-id');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not found');
    });
  });
});
