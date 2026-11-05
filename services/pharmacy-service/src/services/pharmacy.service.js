const crypto = require('crypto');
const { initRedis, isRedisConnected } = require('../config/redis');

class PharmacyService {
  constructor() {
    this.pharmacies = new Map();
    this.medicines = new Map();
    this.REDIS_GEO_KEY = 'pharmacies:geo';
    this._seedInitialMedicines();
  }

  /**
   * Seed initial catalog for instant local testing & demo
   */
  _seedInitialMedicines() {
    const initialSeed = [
      {
        id: 'med-dolo-650',
        storeId: 'store-001',
        name: 'Dolo 650mg Tablet',
        genericName: 'Paracetamol',
        category: 'Pain Relief',
        batchNumber: 'BATCH-2026-A1',
        expiryDate: '2027-10-31',
        price: 32.50,
        stockQuantity: 120,
        reorderLevel: 20,
        inStock: true,
        locationRack: 'Shelf A-1'
      },
      {
        id: 'med-augmentin-625',
        storeId: 'store-001',
        name: 'Augmentin 625 Duo Tablet',
        genericName: 'Amoxicillin + Clavulanic Acid',
        category: 'Antibiotics',
        batchNumber: 'BATCH-2026-B3',
        expiryDate: '2026-12-15',
        price: 210.00,
        stockQuantity: 45,
        reorderLevel: 10,
        inStock: true,
        locationRack: 'Shelf B-3'
      },
      {
        id: 'med-cetzine-10',
        storeId: 'store-001',
        name: 'Cetzine 10mg Tablet',
        genericName: 'Cetirizine Hydrochloride',
        category: 'Allergy / Cold',
        batchNumber: 'BATCH-2026-C2',
        expiryDate: '2028-04-30',
        price: 18.00,
        stockQuantity: 80,
        reorderLevel: 15,
        inStock: true,
        locationRack: 'Shelf C-2'
      },
      {
        id: 'med-glycomet-500',
        storeId: 'store-001',
        name: 'Glycomet 500mg Tablet',
        genericName: 'Metformin Hydrochloride',
        category: 'Diabetes',
        batchNumber: 'BATCH-2026-D1',
        expiryDate: '2027-08-31',
        price: 42.00,
        stockQuantity: 150,
        reorderLevel: 25,
        inStock: true,
        locationRack: 'Shelf D-1'
      },
      {
        id: 'med-pan-40',
        storeId: 'store-001',
        name: 'Pan 40 Tablet',
        genericName: 'Pantoprazole Gastro-Resistant',
        category: 'Antacid / Gastro',
        batchNumber: 'BATCH-2026-P4',
        expiryDate: '2027-05-30',
        price: 85.00,
        stockQuantity: 65,
        reorderLevel: 15,
        inStock: true,
        locationRack: 'Shelf A-3'
      },
      {
        id: 'med-montair-lc',
        storeId: 'store-001',
        name: 'Montair LC Tablet',
        genericName: 'Montelukast + Levocetirizine',
        category: 'Respiratory',
        batchNumber: 'BATCH-2026-M1',
        expiryDate: '2026-11-30',
        price: 145.00,
        stockQuantity: 6,
        reorderLevel: 10,
        inStock: true,
        locationRack: 'Shelf C-4'
      },
      {
        id: 'med-atorva-20',
        storeId: 'store-001',
        name: 'Atorva 20mg Tablet',
        genericName: 'Atorvastatin Calcium',
        category: 'Cardiology',
        batchNumber: 'BATCH-2025-Z9',
        expiryDate: '2026-08-15',
        price: 160.00,
        stockQuantity: 0,
        reorderLevel: 15,
        inStock: false,
        locationRack: 'Shelf D-4'
      }
    ];

    for (const med of initialSeed) {
      this.medicines.set(med.id, med);
    }
  }

  /**
   * Calculate Haversine distance in kilometers between two geo coordinates
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} distance in kilometers rounded to 2 decimal places
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    if (lat1 === lat2 && lng1 === lng2) {
      return 0;
    }

    const EARTH_RADIUS_KM = 6371;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = EARTH_RADIUS_KM * c;

    return Math.round(distance * 100) / 100;
  }

  /**
   * Helper to normalize coordinate input
   */
  _extractCoordinates(data) {
    let lat = null;
    let lng = null;

    if (data.coordinates) {
      lat = data.coordinates.latitude ?? data.coordinates.lat;
      lng = data.coordinates.longitude ?? data.coordinates.lng;
    } else {
      lat = data.latitude ?? data.lat;
      lng = data.longitude ?? data.lng;
    }

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      throw new Error('Valid coordinates (latitude and longitude) are required');
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      throw new Error('Valid coordinates (latitude and longitude) are required');
    }

    if (parsedLat < -90 || parsedLat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (parsedLng < -180 || parsedLng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return {
      latitude: parsedLat,
      longitude: parsedLng
    };
  }

  /**
   * Register a new pharmacy
   */
  async registerPharmacy(data) {
    if (!data || !data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      throw new Error('Pharmacy name is required');
    }

    const coordinates = this._extractCoordinates(data);
    const id = data.id || crypto.randomUUID();

    const pharmacy = {
      id,
      name: data.name.trim(),
      address: data.address || '',
      phone: data.phone || '',
      coordinates,
      inventory: Array.isArray(data.inventory)
        ? data.inventory.map((item) => ({
            id: item.id || crypto.randomUUID(),
            name: item.name,
            dosage: item.dosage || '',
            quantity: typeof item.quantity === 'number' ? item.quantity : 0,
            price: typeof item.price === 'number' ? item.price : 0,
            inStock: item.inStock !== undefined ? Boolean(item.inStock) : (item.quantity > 0)
          }))
        : [],
      createdAt: data.createdAt || new Date().toISOString()
    };

    // Save in memory
    this.pharmacies.set(id, pharmacy);

    // Save to Redis if connected
    if (isRedisConnected()) {
      try {
        const redis = initRedis();
        if (redis) {
          // GEOADD key longitude latitude member
          await redis.geoadd(
            this.REDIS_GEO_KEY,
            coordinates.longitude,
            coordinates.latitude,
            id
          );
          await redis.set(`pharmacy:${id}`, JSON.stringify(pharmacy));
        }
      } catch (err) {
        // Fallback to in-memory on redis failure
        console.warn('Redis GEO indexing failed, using in-memory store:', err.message);
      }
    }

    return pharmacy;
  }

  /**
   * Find pharmacies nearby within radius (in km), optionally filtering by medicine
   */
  async findNearbyPharmacies({ latitude, longitude, lat, lng, radiusKm, radius, medicineName, medicine }) {
    const searchLat = latitude ?? lat;
    const searchLng = longitude ?? lng;

    if (searchLat === undefined || searchLng === undefined || searchLat === null || searchLng === null) {
      throw new Error('Valid search coordinates (latitude and longitude) are required');
    }

    const parsedLat = parseFloat(searchLat);
    const parsedLng = parseFloat(searchLng);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      throw new Error('Valid search coordinates (latitude and longitude) are required');
    }

    if (parsedLat < -90 || parsedLat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }

    if (parsedLng < -180 || parsedLng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    const searchRadius = parseFloat(radiusKm ?? radius ?? 5);
    const targetMedicine = (medicineName || medicine || '').trim().toLowerCase();

    const nearbyList = [];

    for (const pharmacy of this.pharmacies.values()) {
      const distance = this.calculateDistance(
        parsedLat,
        parsedLng,
        pharmacy.coordinates.latitude,
        pharmacy.coordinates.longitude
      );

      if (distance <= searchRadius) {
        let matchesMedicine = true;
        let matchedMedicineItem = null;

        if (targetMedicine) {
          matchedMedicineItem = pharmacy.inventory.find(
            (item) =>
              item.name &&
              item.name.toLowerCase().includes(targetMedicine) &&
              (item.quantity > 0 || item.inStock === true)
          );

          if (!matchedMedicineItem) {
            matchesMedicine = false;
          }
        }

        if (matchesMedicine) {
          nearbyList.push({
            ...pharmacy,
            distanceKm: distance,
            ...(matchedMedicineItem ? { matchingMedicine: matchedMedicineItem } : {})
          });
        }
      }
    }

    // Sort by proximity ascending
    nearbyList.sort((a, b) => a.distanceKm - b.distanceKm);

    return nearbyList;
  }

  /**
   * Get pharmacy by ID
   */
  async getPharmacyById(id) {
    const pharmacy = this.pharmacies.get(id);
    if (!pharmacy) {
      return null;
    }
    return pharmacy;
  }

  /**
   * Get all pharmacies
   */
  async getAllPharmacies() {
    return Array.from(this.pharmacies.values());
  }

  /**
   * Add a medicine to the catalog (multi-tenant ready schema)
   */
  async addMedicine(medicineData) {
    if (!medicineData || !medicineData.name || typeof medicineData.name !== 'string' || medicineData.name.trim() === '') {
      const err = new Error('Medicine name is required');
      err.statusCode = 400;
      throw err;
    }

    const id = medicineData.id || crypto.randomUUID();
    const storeId = medicineData.storeId || 'store-001';
    const name = medicineData.name.trim();
    const genericName = (medicineData.genericName || '').trim();
    const category = (medicineData.category || 'General').trim();
    const batchNumber = (medicineData.batchNumber || '').trim();
    const expiryDate = medicineData.expiryDate || '';
    const price = typeof medicineData.price === 'number' ? medicineData.price : Number(medicineData.price || 0);
    const stockQuantity = typeof medicineData.stockQuantity === 'number' ? medicineData.stockQuantity : Number(medicineData.stockQuantity || 0);
    const reorderLevel = typeof medicineData.reorderLevel === 'number' ? medicineData.reorderLevel : Number(medicineData.reorderLevel ?? 10);
    const inStock = medicineData.inStock !== undefined ? Boolean(medicineData.inStock) : stockQuantity > 0;
    const locationRack = (medicineData.locationRack || '').trim();
    const createdAt = medicineData.createdAt || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    const medicine = {
      id,
      storeId,
      name,
      genericName,
      category,
      batchNumber,
      expiryDate,
      price,
      stockQuantity,
      reorderLevel,
      inStock,
      locationRack,
      createdAt,
      updatedAt
    };

    this.medicines.set(id, medicine);
    return medicine;
  }

  /**
   * Public search returning matching medicines by name or genericName
   * with real-time stockQuantity, inStock, and price
   */
  async searchMedicines({ query, storeId } = {}) {
    const q = (query || '').trim().toLowerCase();
    const results = [];

    for (const medicine of this.medicines.values()) {
      if (storeId && medicine.storeId !== storeId) {
        continue;
      }

      if (q) {
        const nameMatch = medicine.name && medicine.name.toLowerCase().includes(q);
        const genericMatch = medicine.genericName && medicine.genericName.toLowerCase().includes(q);
        if (!nameMatch && !genericMatch) {
          continue;
        }
      }

      // Return medicine with real-time inStock
      results.push({
        ...medicine,
        inStock: medicine.stockQuantity > 0
      });
    }

    return results;
  }

  /**
   * Get single medicine by ID
   */
  async getMedicineById(id) {
    if (!id) return null;
    return this.medicines.get(id) || null;
  }

  /**
   * List medicines filtered optionally by storeId and category
   */
  async listMedicines({ storeId, category } = {}) {
    const results = [];
    const targetCat = (category || '').trim().toLowerCase();

    for (const medicine of this.medicines.values()) {
      if (storeId && medicine.storeId !== storeId) {
        continue;
      }
      if (targetCat && (!medicine.category || medicine.category.toLowerCase() !== targetCat)) {
        continue;
      }
      results.push({
        ...medicine,
        inStock: medicine.stockQuantity > 0
      });
    }

    return results;
  }

  /**
   * Update medicine fields
   */
  async updateMedicine(id, updateData = {}) {
    const medicine = this.medicines.get(id);
    if (!medicine) {
      return null;
    }

    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim() === '') {
        const err = new Error('Medicine name cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      medicine.name = updateData.name.trim();
    }
    if (updateData.genericName !== undefined) medicine.genericName = (updateData.genericName || '').trim();
    if (updateData.category !== undefined) medicine.category = (updateData.category || '').trim();
    if (updateData.batchNumber !== undefined) medicine.batchNumber = (updateData.batchNumber || '').trim();
    if (updateData.expiryDate !== undefined) medicine.expiryDate = updateData.expiryDate;
    if (updateData.price !== undefined) {
      medicine.price = typeof updateData.price === 'number' ? updateData.price : Number(updateData.price);
    }
    if (updateData.stockQuantity !== undefined) {
      medicine.stockQuantity = typeof updateData.stockQuantity === 'number' ? updateData.stockQuantity : Number(updateData.stockQuantity);
    }
    if (updateData.reorderLevel !== undefined) {
      medicine.reorderLevel = typeof updateData.reorderLevel === 'number' ? updateData.reorderLevel : Number(updateData.reorderLevel);
    }
    if (updateData.locationRack !== undefined) medicine.locationRack = (updateData.locationRack || '').trim();
    if (updateData.storeId !== undefined) medicine.storeId = updateData.storeId;

    medicine.inStock = updateData.inStock !== undefined ? Boolean(updateData.inStock) : medicine.stockQuantity > 0;
    medicine.updatedAt = new Date().toISOString();

    this.medicines.set(id, medicine);
    return medicine;
  }

  /**
   * Adjust medicine stock: DEDUCT or RESTOCK
   */
  async adjustStock(id, { action, quantity } = {}) {
    const medicine = this.medicines.get(id);
    if (!medicine) {
      const err = new Error(`Medicine with id '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const numQty = Number(quantity);
    if (isNaN(numQty) || numQty <= 0 || !Number.isInteger(numQty)) {
      const err = new Error('Quantity must be a positive integer');
      err.statusCode = 400;
      throw err;
    }

    const act = (action || '').trim().toUpperCase();
    if (act !== 'DEDUCT' && act !== 'RESTOCK') {
      const err = new Error(`Invalid stock adjustment action: '${action}'. Must be DEDUCT or RESTOCK`);
      err.statusCode = 400;
      throw err;
    }

    if (act === 'DEDUCT') {
      if (medicine.stockQuantity < numQty) {
        const err = new Error(`Insufficient stock for medicine '${medicine.name}'. Available: ${medicine.stockQuantity}, Requested: ${numQty}`);
        err.statusCode = 409;
        throw err;
      }
      medicine.stockQuantity -= numQty;
    } else if (act === 'RESTOCK') {
      medicine.stockQuantity += numQty;
    }

    medicine.inStock = medicine.stockQuantity > 0;
    medicine.updatedAt = new Date().toISOString();
    this.medicines.set(id, medicine);

    return medicine;
  }

  /**
   * Clear in-memory storage (useful for testing)
   */
  clear() {
    this.pharmacies.clear();
    this.medicines.clear();
  }
}

// Singleton instance
module.exports = new PharmacyService();
