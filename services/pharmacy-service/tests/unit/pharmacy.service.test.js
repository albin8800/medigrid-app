const pharmacyService = require('../../src/services/pharmacy.service');

describe('PharmacyService Unit Tests', () => {
  beforeEach(() => {
    pharmacyService.clear();
  });

  describe('calculateDistance (Haversine)', () => {
    it('should return 0 when coordinates are identical', () => {
      const distance = pharmacyService.calculateDistance(40.7128, -74.006, 40.7128, -74.006);
      expect(distance).toBe(0);
    });

    it('should calculate accurate distance between Times Square and Empire State Building (~1.0 km)', () => {
      // Times Square: 40.7580, -73.9855
      // Empire State: 40.7484, -73.9857
      const distance = pharmacyService.calculateDistance(40.758, -73.9855, 40.7484, -73.9857);
      expect(distance).toBeGreaterThan(0.9);
      expect(distance).toBeLessThan(1.2);
    });

    it('should calculate accurate distance between London and Paris (~343 km)', () => {
      // London: 51.5074, -0.1278
      // Paris: 48.8566, 2.3522
      const distance = pharmacyService.calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
      expect(Math.round(distance)).toBeCloseTo(343, -1);
    });
  });

  describe('registerPharmacy', () => {
    it('should successfully register a pharmacy with coordinates and inventory', async () => {
      const pharmacyData = {
        name: 'MediCare Central',
        address: '123 Main St, New York, NY',
        phone: '555-0199',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.006
        },
        inventory: [
          { name: 'Amoxicillin', dosage: '500mg', quantity: 50, price: 12.5 },
          { name: 'Paracetamol', dosage: '650mg', quantity: 100, price: 5.0 }
        ]
      };

      const registered = await pharmacyService.registerPharmacy(pharmacyData);
      expect(registered).toBeDefined();
      expect(registered.id).toBeDefined();
      expect(registered.name).toBe('MediCare Central');
      expect(registered.coordinates.latitude).toBe(40.7128);
      expect(registered.coordinates.longitude).toBe(-74.006);
      expect(registered.inventory).toHaveLength(2);
    });

    it('should support flat lat and lng coordinates', async () => {
      const pharmacyData = {
        name: 'Flat Coord Pharmacy',
        address: '456 Side Ave',
        lat: 40.72,
        lng: -74.01
      };

      const registered = await pharmacyService.registerPharmacy(pharmacyData);
      expect(registered.coordinates.latitude).toBe(40.72);
      expect(registered.coordinates.longitude).toBe(-74.01);
    });

    it('should reject registration if name is missing', async () => {
      await expect(
        pharmacyService.registerPharmacy({
          coordinates: { latitude: 40.7, longitude: -74.0 }
        })
      ).rejects.toThrow('Pharmacy name is required');
    });

    it('should reject registration if coordinates are missing or invalid', async () => {
      await expect(
        pharmacyService.registerPharmacy({
          name: 'No Coordinates Pharmacy'
        })
      ).rejects.toThrow('Valid coordinates (latitude and longitude) are required');

      await expect(
        pharmacyService.registerPharmacy({
          name: 'Invalid Lat Pharmacy',
          coordinates: { latitude: 95, longitude: -74.0 }
        })
      ).rejects.toThrow('Latitude must be between -90 and 90');

      await expect(
        pharmacyService.registerPharmacy({
          name: 'Invalid Lng Pharmacy',
          coordinates: { latitude: 40.0, longitude: 195 }
        })
      ).rejects.toThrow('Longitude must be between -180 and 180');
    });
  });

  describe('findNearbyPharmacies', () => {
    beforeEach(async () => {
      // 1. Center / Downtown: (40.7128, -74.0060)
      await pharmacyService.registerPharmacy({
        name: 'Downtown Pharmacy',
        address: '10 Broadway, NY',
        coordinates: { latitude: 40.7128, longitude: -74.006 },
        inventory: [
          { name: 'Amoxicillin', dosage: '500mg', quantity: 20, price: 15.0 },
          { name: 'Ibuprofen', dosage: '400mg', quantity: 0, price: 8.0 }
        ]
      });

      // 2. Midtown (~4.5 km away): (40.7500, -73.9900)
      await pharmacyService.registerPharmacy({
        name: 'Midtown Express Chemist',
        address: '500 7th Ave, NY',
        coordinates: { latitude: 40.75, longitude: -73.99 },
        inventory: [
          { name: 'Amoxicillin', dosage: '500mg', quantity: 50, price: 14.0 },
          { name: 'Ibuprofen', dosage: '400mg', quantity: 30, price: 7.5 }
        ]
      });

      // 3. Uptown (~11 km away): (40.8100, -73.9500)
      await pharmacyService.registerPharmacy({
        name: 'Uptown Care Pharma',
        address: '2000 Amsterdam Ave, NY',
        coordinates: { latitude: 40.81, longitude: -73.95 },
        inventory: [
          { name: 'Amoxicillin', dosage: '500mg', quantity: 15, price: 16.0 }
        ]
      });
    });

    it('should find pharmacies within default 5km radius sorted by proximity', async () => {
      // Search from near Downtown NY: 40.7130, -74.0050
      const results = await pharmacyService.findNearbyPharmacies({
        latitude: 40.713,
        longitude: -74.005,
        radiusKm: 5
      });

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Downtown Pharmacy');
      expect(results[1].name).toBe('Midtown Express Chemist');
      expect(results[0].distanceKm).toBeLessThan(results[1].distanceKm);
    });

    it('should expand search when radius is increased to 15km', async () => {
      const results = await pharmacyService.findNearbyPharmacies({
        latitude: 40.713,
        longitude: -74.005,
        radiusKm: 15
      });

      expect(results).toHaveLength(3);
      expect(results[2].name).toBe('Uptown Care Pharma');
    });

    it('should filter pharmacies by medicine name (case-insensitive) and in-stock quantity', async () => {
      // Ibuprofen is in Downtown (qty 0) and Midtown (qty 30)
      const results = await pharmacyService.findNearbyPharmacies({
        latitude: 40.713,
        longitude: -74.005,
        radiusKm: 10,
        medicineName: 'ibuprofen'
      });

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Midtown Express Chemist');
      expect(results[0].matchingMedicine).toBeDefined();
      expect(results[0].matchingMedicine.name.toLowerCase()).toBe('ibuprofen');
      expect(results[0].matchingMedicine.quantity).toBe(30);
    });

    it('should return empty list when medicine is not available anywhere nearby', async () => {
      const results = await pharmacyService.findNearbyPharmacies({
        latitude: 40.713,
        longitude: -74.005,
        radiusKm: 10,
        medicineName: 'NonExistentDrug123'
      });

      expect(results).toEqual([]);
    });

    it('should throw error when latitude or longitude is missing or invalid', async () => {
      await expect(
        pharmacyService.findNearbyPharmacies({ longitude: -74.005 })
      ).rejects.toThrow('Valid search coordinates (latitude and longitude) are required');

      await expect(
        pharmacyService.findNearbyPharmacies({ latitude: 'invalid', longitude: -74.005 })
      ).rejects.toThrow('Valid search coordinates (latitude and longitude) are required');
    });
  });
});
