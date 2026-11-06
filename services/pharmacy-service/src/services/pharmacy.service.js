const crypto = require('crypto');
const { initRedis, isRedisConnected } = require('../config/redis');

class PharmacyService {
  constructor() {
    this.pharmacies = new Map();
    this.medicines = new Map();
    this.stores = new Map();
    this.REDIS_GEO_KEY = 'pharmacies:geo';
    // Clean production baseline: No dummy data pre-loaded
  }

  /**
   * Cryptographically hash a password using scrypt with a random salt
   */
  hashPassword(plainPassword) {
    if (!plainPassword || typeof plainPassword !== 'string') {
      plainPassword = 'changeMe123';
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Cryptographically verify a password using timing-safe comparison
   */
  verifyPassword(plainPassword, storedHash) {
    if (!plainPassword || !storedHash || typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
      return false;
    }
    // Backward compatibility for legacy test strings without salt separator
    if (!storedHash.includes(':')) {
      const a = Buffer.from(plainPassword);
      const b = Buffer.from(storedHash);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    }
    try {
      const [salt, key] = storedHash.split(':');
      if (!salt || !key) return false;
      const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
      const hashBuf = Buffer.from(hash, 'hex');
      const keyBuf = Buffer.from(key, 'hex');
      return hashBuf.length === keyBuf.length && crypto.timingSafeEqual(hashBuf, keyBuf);
    } catch {
      return false;
    }
  }

  /**
   * Pre-seed default medical stores
   */
  seedDefaultStores() {
    const defaultStores = [
      {
        id: 'store-001',
        name: 'Apollo Pharmacy - Indiranagar',
        licenseNumber: 'KA-BLR-2023-001',
        address: '100 Ft Rd, Indiranagar',
        city: 'Bangalore',
        phone: '+91-9876543210',
        email: 'apollo.indiranagar@medigrid.com',
        password: this.hashPassword('store123'),
        coordinates: { lat: 12.9784, lng: 77.6408 },
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'store-002',
        name: 'MedPlus Chemist - Koramangala',
        licenseNumber: 'KA-BLR-2023-002',
        address: '80 Ft Rd, 4th Block, Koramangala',
        city: 'Bangalore',
        phone: '+91-9876543211',
        email: 'medplus.koramangala@medigrid.com',
        password: this.hashPassword('store123'),
        coordinates: { lat: 12.9352, lng: 77.6245 },
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'store-003',
        name: 'Lifecare Pharmacy - HSR Layout',
        licenseNumber: 'KA-BLR-2023-003',
        address: '17th Main Rd, Sector 4, HSR Layout',
        city: 'Bangalore',
        phone: '+91-9876543212',
        email: 'lifecare.hsr@medigrid.com',
        password: this.hashPassword('store123'),
        coordinates: { lat: 12.9121, lng: 77.6446 },
        status: 'SUSPENDED',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ];

    for (const store of defaultStores) {
      this.stores.set(store.id, { ...store });
    }
  }

  /**
   * Seed initial catalog for instant local testing & demo
   */
  _seedInitialMedicines() {
    const initialSeed = [
      // store-001 medicines
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
      },

      // store-002 medicines
      {
        id: 'med-dolo-650-s2',
        storeId: 'store-002',
        name: 'Dolo 650mg Tablet',
        genericName: 'Paracetamol',
        category: 'Pain Relief',
        batchNumber: 'BATCH-2026-S2A',
        expiryDate: '2027-12-31',
        price: 30.00,
        stockQuantity: 60,
        reorderLevel: 15,
        inStock: true,
        locationRack: 'Rack 2-A'
      },
      {
        id: 'med-augmentin-625-s2',
        storeId: 'store-002',
        name: 'Augmentin 625 Duo Tablet',
        genericName: 'Amoxicillin + Clavulanic Acid',
        category: 'Antibiotics',
        batchNumber: 'BATCH-2026-S2B',
        expiryDate: '2026-11-15',
        price: 205.00,
        stockQuantity: 25,
        reorderLevel: 10,
        inStock: true,
        locationRack: 'Rack 2-B'
      },
      {
        id: 'med-cetzine-10-s2',
        storeId: 'store-002',
        name: 'Cetzine 10mg Tablet',
        genericName: 'Cetirizine Hydrochloride',
        category: 'Allergy / Cold',
        batchNumber: 'BATCH-2026-S2C',
        expiryDate: '2028-02-28',
        price: 17.50,
        stockQuantity: 50,
        reorderLevel: 15,
        inStock: true,
        locationRack: 'Rack 2-C'
      },

      // store-003 medicines (Suspended store - for testing exclusion)
      {
        id: 'med-dolo-650-s3',
        storeId: 'store-003',
        name: 'Dolo 650mg Tablet',
        genericName: 'Paracetamol',
        category: 'Pain Relief',
        batchNumber: 'BATCH-2026-S3A',
        expiryDate: '2027-06-30',
        price: 28.00,
        stockQuantity: 100,
        reorderLevel: 20,
        inStock: true,
        locationRack: 'Rack 3-A'
      }
    ];

    for (const med of initialSeed) {
      this.medicines.set(med.id, { ...med });
    }
  }

  /**
   * Reset data to initial seeded state
   */
  resetToSeed() {
    this.clear();
    this.seedDefaultStores();
    this._seedInitialMedicines();
  }

  /**
   * Calculate Haversine distance in kilometers between two geo coordinates
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
      lat: parsedLat,
      lng: parsedLng,
      latitude: parsedLat,
      longitude: parsedLng
    };
  }

  /**
   * Helper to sanitize store object (remove password)
   * Ensures licenseNumber, city, address, phone, coordinates are never stripped or missing.
   */
  _sanitizeStore(store) {
    if (!store) return null;
    const { password, ...sanitized } = store;
    return {
      id: sanitized.id,
      name: sanitized.name,
      licenseNumber: sanitized.licenseNumber || '',
      address: sanitized.address || '',
      city: sanitized.city || '',
      phone: sanitized.phone || '',
      email: sanitized.email || '',
      coordinates: sanitized.coordinates || { lat: 0, lng: 0 },
      status: sanitized.status || 'ACTIVE',
      createdAt: sanitized.createdAt,
      updatedAt: sanitized.updatedAt,
      ...sanitized
    };
  }

  // ==========================================
  // STORE / TENANT MODEL & AUTH METHODS
  // ==========================================

  /**
   * Register/onboard a new medical store
   */
  async registerStore(data) {
    if (!data || !data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      const err = new Error('Store name is required');
      err.statusCode = 400;
      throw err;
    }

    if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
      const err = new Error('Store email is required');
      err.statusCode = 400;
      throw err;
    }

    const email = data.email.trim().toLowerCase();
    const existing = await this.getStoreByEmail(email);
    if (existing) {
      const err = new Error(`Store with email '${email}' already exists`);
      err.statusCode = 409;
      throw err;
    }

    const coords = this._extractCoordinates(data);
    const id = data.id || `store-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const store = {
      id,
      name: data.name.trim(),
      licenseNumber: (data.licenseNumber || `LIC-${Date.now()}`).trim(),
      address: (data.address || '').trim(),
      city: (data.city || '').trim(),
      phone: (data.phone || '').trim(),
      email,
      password: this.hashPassword(data.password || 'store123'),
      coordinates: { lat: coords.lat, lng: coords.lng },
      status: (data.status || 'ACTIVE').toUpperCase(),
      createdAt: data.createdAt || now,
      updatedAt: now
    };

    this.stores.set(id, store);
    return this._sanitizeStore(store);
  }

  /**
   * Get store by ID (sanitized)
   */
  async getStoreById(id) {
    if (!id) return null;
    const store = this.stores.get(id);
    return store ? this._sanitizeStore(store) : null;
  }

  /**
   * Get raw store by email (internal use for login)
   */
  async getStoreByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    for (const store of this.stores.values()) {
      if (store.email && store.email.toLowerCase() === normalized) {
        return store;
      }
    }
    return null;
  }

  /**
   * List all stores with optional filtering by status and search
   */
  async listStores({ status, search } = {}) {
    let results = Array.from(this.stores.values());

    if (status) {
      const targetStatus = status.trim().toUpperCase();
      results = results.filter((s) => s.status === targetStatus);
    }

    if (search) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.licenseNumber && s.licenseNumber.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q))
      );
    }

    return results.map((s) => this._sanitizeStore(s));
  }

  /**
   * Update store status (ACTIVE or SUSPENDED)
   */
  async updateStoreStatus(id, status) {
    const store = this.stores.get(id);
    if (!store) {
      const err = new Error(`Store with id '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    const newStatus = (status || '').trim().toUpperCase();
    if (newStatus !== 'ACTIVE' && newStatus !== 'SUSPENDED') {
      const err = new Error("Invalid status. Must be 'ACTIVE' or 'SUSPENDED'");
      err.statusCode = 400;
      throw err;
    }

    store.status = newStatus;
    store.updatedAt = new Date().toISOString();
    this.stores.set(id, store);

    return this._sanitizeStore(store);
  }

  /**
   * Delete a store
   */
  async deleteStore(id) {
    if (!this.stores.has(id)) {
      const err = new Error(`Store with id '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }
    this.stores.delete(id);
    return true;
  }

  /**
   * Store login validating email/password and active status
   */
  async loginStore(email, password) {
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const store = await this.getStoreByEmail(email);
    if (!store || !this.verifyPassword(password, store.password)) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (store.status === 'SUSPENDED') {
      const err = new Error('Store account is suspended. Please contact administrator.');
      err.statusCode = 403;
      throw err;
    }

    const token = `store-token-${crypto.randomBytes(16).toString('hex')}`;
    return {
      token,
      store: this._sanitizeStore(store)
    };
  }

  /**
   * Super Admin login (Strictly verified against environment credentials)
   */
  async loginAdmin(email, password) {
    if (!email || !password) {
      const err = new Error('Email and password are required');
      err.statusCode = 400;
      throw err;
    }

    const adminEmail = process.env.ADMIN_EMAIL || (process.env.NODE_ENV === 'test' ? 'admin@medigrid.com' : undefined);
    const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'test' ? 'admin123' : undefined);

    if (!adminEmail || !adminPassword) {
      const err = new Error('Super Admin credentials not configured in environment (ADMIN_EMAIL, ADMIN_PASSWORD)');
      err.statusCode = 500;
      throw err;
    }

    const emailMatches = email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
    const passBuf = Buffer.from(password);
    const expectedBuf = Buffer.from(adminPassword);
    const passMatches = passBuf.length === expectedBuf.length && crypto.timingSafeEqual(passBuf, expectedBuf);

    if (!emailMatches || !passMatches) {
      const err = new Error('Invalid admin email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = `admin-token-${crypto.randomBytes(16).toString('hex')}`;
    return {
      token,
      admin: {
        email: adminEmail,
        role: 'SUPER_ADMIN'
      }
    };
  }

  // ==========================================
  // PUBLIC LOCATION-BASED MEDICINE DISCOVERY
  // ==========================================

  /**
   * Flexible / Token-Aware Medicine Search Matcher
   * Matches bidirectional substrings and word tokens (e.g. "Dolo" matches "Dolo 650", "Dolo 650" matches "Dolo")
   */
  matchesMedicine(med, searchQuery) {
    if (!searchQuery) return true;
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return true;

    const name = (med.name || '').trim().toLowerCase();
    const generic = (med.genericName || '').trim().toLowerCase();

    // 1. Exact or substring match in either direction
    if (name && (name.includes(q) || q.includes(name))) return true;
    if (generic && (generic.includes(q) || q.includes(generic))) return true;

    // 2. Token / word boundary matching
    const qTokens = q.split(/[\s\-_,./]+/).filter((t) => t.length > 0);
    const medTokens = `${name} ${generic}`.split(/[\s\-_,./]+/).filter((t) => t.length > 0);

    const nonNumericQTokens = qTokens.filter((t) => isNaN(Number(t)));
    if (nonNumericQTokens.length > 0) {
      const match = nonNumericQTokens.some((qt) =>
        medTokens.some((mt) => mt.includes(qt) || qt.includes(mt))
      );
      if (match) return true;
    }

    return qTokens.some((qt) => medTokens.some((mt) => mt.includes(qt) || qt.includes(mt)));
  }

  /**
   * Public Location-Based Medicine Discovery API
   * Strict security: Masks internal confidential fields and excludes SUSPENDED stores
   */
  async publicSearchMedicines({ medicine, lat, lng, radius, city } = {}) {
    const targetMedicine = (medicine || '').trim().toLowerCase();
    const isUnlimited = radius === 'all' || radius === 'any' || radius === 'unlimited' || radius === '0' || Number(radius) === 0;
    const searchRadius = isUnlimited ? Infinity : Number(radius ?? 15);
    const targetCity = (city || '').trim().toLowerCase();

    let searchLat = null;
    let searchLng = null;

    if (lat !== undefined && lat !== null && lng !== undefined && lng !== null) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        searchLat = parsedLat;
        searchLng = parsedLng;
      }
    }

    const results = [];

    // Loop through registered stores
    for (const store of this.stores.values()) {
      // STRICT SECURITY: MUST NEVER return medicines from SUSPENDED stores
      if (store.status !== 'ACTIVE') {
        continue;
      }

      // Filter by city if specified
      if (targetCity) {
        if (!store.city || !store.city.toLowerCase().includes(targetCity)) {
          continue;
        }
      }

      // Calculate distance if coordinates provided
      let distanceKm = null;
      if (searchLat !== null && searchLng !== null && store.coordinates) {
        const storeLat = store.coordinates.lat ?? store.coordinates.latitude;
        const storeLng = store.coordinates.lng ?? store.coordinates.longitude;
        if (storeLat !== undefined && storeLng !== undefined) {
          distanceKm = this.calculateDistance(searchLat, searchLng, storeLat, storeLng);
          if (distanceKm > searchRadius) {
            continue; // Out of radius
          }
        }
      }

      // Find matching medicines for this store
      let storeMedicineMatches = 0;
      for (const med of this.medicines.values()) {
        if (med.storeId !== store.id) {
          continue;
        }

        if (targetMedicine && !this.matchesMedicine(med, targetMedicine)) {
          continue;
        }

        storeMedicineMatches++;

        // Determine stock status
        let stockStatus = 'IN_STOCK';
        const qty = Number(med.stockQuantity || 0);
        const reorder = Number(med.reorderLevel || 10);
        if (qty <= 0 || !med.inStock) {
          stockStatus = 'OUT_OF_STOCK';
        } else if (qty <= reorder) {
          stockStatus = 'LOW_STOCK';
        }

        // PRIVACY & FIELD MASKING: Return ONLY appropriate public customer details
        results.push({
          storeId: store.id,
          storeName: store.name,
          storeAddress: store.address,
          distanceKm: distanceKm !== null ? distanceKm : undefined,
          storePhone: store.phone,
          medicineName: med.name,
          genericName: med.genericName,
          price: med.price,
          stockStatus,
          inStock: qty > 0
        });
      }

      // If default search (no medicine query provided), also list the store itself so user sees nearby pharmacies
      if (!targetMedicine && storeMedicineMatches === 0) {
        results.push({
          storeId: store.id,
          storeName: store.name,
          storeAddress: store.address,
          distanceKm: distanceKm !== null ? distanceKm : undefined,
          storePhone: store.phone,
          medicineName: 'Full Pharmacy Counter',
          genericName: 'All General & Prescription Medicines Available In-Store',
          price: 0,
          stockStatus: 'IN_STOCK',
          inStock: true
        });
      }
    }

    // Sort stores by proximity (closest to furthest) if coordinates were provided
    if (searchLat !== null && searchLng !== null) {
      results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }

    return results;
  }

  // ==========================================
  // PHARMACY (LEGACY BACKWARD COMPATIBILITY)
  // ==========================================

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
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      },
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

    this.pharmacies.set(id, pharmacy);

    if (isRedisConnected()) {
      try {
        const redis = initRedis();
        if (redis) {
          await redis.geoadd(
            this.REDIS_GEO_KEY,
            coordinates.longitude,
            coordinates.latitude,
            id
          );
          await redis.set(`pharmacy:${id}`, JSON.stringify(pharmacy));
        }
      } catch (err) {
        console.warn('Redis GEO indexing failed, using in-memory store:', err.message);
      }
    }

    return pharmacy;
  }

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

    nearbyList.sort((a, b) => a.distanceKm - b.distanceKm);
    return nearbyList;
  }

  async getPharmacyById(id) {
    const pharmacy = this.pharmacies.get(id);
    return pharmacy || null;
  }

  async getAllPharmacies() {
    return Array.from(this.pharmacies.values());
  }

  // ==========================================
  // MEDICINE CATALOG & INVENTORY APIs
  // ==========================================

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

  async searchMedicines({ query, storeId } = {}) {
    const q = (query || '').trim().toLowerCase();
    const results = [];

    for (const medicine of this.medicines.values()) {
      if (storeId && medicine.storeId !== storeId) {
        continue;
      }

      if (q && !this.matchesMedicine(medicine, q)) {
        continue;
      }

      results.push({
        ...medicine,
        inStock: medicine.stockQuantity > 0
      });
    }

    return results;
  }

  async getMedicineById(id) {
    if (!id) return null;
    return this.medicines.get(id) || null;
  }

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

  async adjustStock(id, { action, quantity, storeId } = {}) {
    const medicine = this.medicines.get(id);
    if (!medicine) {
      const err = new Error(`Medicine with id '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (storeId && medicine.storeId !== storeId) {
      const err = new Error(`Medicine '${id}' does not belong to store '${storeId}'`);
      err.statusCode = 403;
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

  clear() {
    this.pharmacies.clear();
    this.medicines.clear();
    this.stores.clear();
  }
}

// Singleton instance
module.exports = new PharmacyService();
