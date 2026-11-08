const crypto = require('crypto');
const { initRedis, isRedisConnected } = require('../config/redis');
const db = require('../config/db');

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

  /**
   * Map PostgreSQL database row to normalized Store object
   */
  _mapDbRowToStore(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      licenseNumber: row.license_number || '',
      email: row.email,
      password: row.password_hash,
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      coordinates: {
        lat: row.latitude !== null && row.latitude !== undefined ? parseFloat(row.latitude) : 0,
        lng: row.longitude !== null && row.longitude !== undefined ? parseFloat(row.longitude) : 0
      },
      status: (row.status || 'ACTIVE').toUpperCase(),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
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

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const insertSql = `
            INSERT INTO stores (id, name, license_number, email, password_hash, phone, address, city, latitude, longitude, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              license_number = EXCLUDED.license_number,
              email = EXCLUDED.email,
              password_hash = EXCLUDED.password_hash,
              phone = EXCLUDED.phone,
              address = EXCLUDED.address,
              city = EXCLUDED.city,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at
            RETURNING *;
          `;
          const result = await pool.query(insertSql, [
            store.id,
            store.name,
            store.licenseNumber,
            store.email,
            store.password,
            store.phone,
            store.address,
            store.city,
            store.coordinates.lat,
            store.coordinates.lng,
            store.status,
            store.createdAt,
            store.updatedAt
          ]);

          if (result.rows && result.rows.length > 0) {
            const savedStore = this._mapDbRowToStore(result.rows[0]);
            this.stores.set(savedStore.id, savedStore);
            return this._sanitizeStore(savedStore);
          }
        }
      } catch (err) {
        if (err.code === '23505') {
          const conflictErr = new Error(`Store with email '${email}' or license number already exists`);
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        console.warn('Postgres persist failed in registerStore, falling back to in-memory:', err.message);
      }
    }

    this.stores.set(id, store);
    return this._sanitizeStore(store);
  }

  /**
   * Get store by ID (sanitized)
   */
  async getStoreById(id) {
    if (!id) return null;

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const res = await pool.query('SELECT * FROM stores WHERE id = $1 LIMIT 1', [id]);
          if (res.rows && res.rows.length > 0) {
            return this._sanitizeStore(this._mapDbRowToStore(res.rows[0]));
          }
          return null;
        }
      } catch (err) {
        console.warn('Postgres getStoreById failed, falling back:', err.message);
      }
    }

    const store = this.stores.get(id);
    return store ? this._sanitizeStore(store) : null;
  }

  /**
   * Get raw store by email (internal use for login)
   */
  async getStoreByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const res = await pool.query('SELECT * FROM stores WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalized]);
          if (res.rows && res.rows.length > 0) {
            return this._mapDbRowToStore(res.rows[0]);
          }
          return null;
        }
      } catch (err) {
        console.warn('Postgres getStoreByEmail failed, falling back:', err.message);
      }
    }

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
    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          let sql = 'SELECT * FROM stores WHERE 1=1';
          const params = [];
          let paramIdx = 1;

          if (status) {
            sql += ` AND UPPER(status) = UPPER($${paramIdx++})`;
            params.push(status.trim());
          }

          if (search) {
            const q = `%${search.trim().toLowerCase()}%`;
            sql += ` AND (LOWER(name) LIKE $${paramIdx} OR LOWER(license_number) LIKE $${paramIdx} OR LOWER(city) LIKE $${paramIdx})`;
            params.push(q);
            paramIdx++;
          }

          sql += ' ORDER BY created_at DESC';

          const res = await pool.query(sql, params);
          if (res.rows) {
            return res.rows.map((row) => this._sanitizeStore(this._mapDbRowToStore(row)));
          }
        }
      } catch (err) {
        console.warn('Postgres listStores failed, falling back:', err.message);
      }
    }

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
    const newStatus = (status || '').trim().toUpperCase();
    if (newStatus !== 'ACTIVE' && newStatus !== 'SUSPENDED') {
      const err = new Error("Invalid status. Must be 'ACTIVE' or 'SUSPENDED'");
      err.statusCode = 400;
      throw err;
    }

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const now = new Date().toISOString();
          const res = await pool.query(
            'UPDATE stores SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
            [newStatus, now, id]
          );
          if (!res.rows || res.rows.length === 0) {
            const err = new Error(`Store with id '${id}' not found`);
            err.statusCode = 404;
            throw err;
          }
          const updatedStore = this._mapDbRowToStore(res.rows[0]);
          this.stores.set(id, updatedStore);
          return this._sanitizeStore(updatedStore);
        }
      } catch (err) {
        if (err.statusCode) throw err;
        console.warn('Postgres updateStoreStatus failed, falling back:', err.message);
      }
    }

    const store = this.stores.get(id);
    if (!store) {
      const err = new Error(`Store with id '${id}' not found`);
      err.statusCode = 404;
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
    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const res = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING id', [id]);
          if (!res.rows || res.rows.length === 0) {
            const err = new Error(`Store with id '${id}' not found`);
            err.statusCode = 404;
            throw err;
          }
          this.stores.delete(id);
          return true;
        }
      } catch (err) {
        if (err.statusCode) throw err;
        console.warn('Postgres deleteStore failed, falling back:', err.message);
      }
    }

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

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

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

    // Loop through registered stores (from Postgres in cloud, or memory in mock)
    const allStores = !db.isMockMode() ? await this.listStores() : Array.from(this.stores.values());
    for (const store of allStores) {
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
      const storeMeds = !db.isMockMode()
        ? await this.listMedicines({ storeId: store.id })
        : Array.from(this.medicines.values()).filter((m) => m.storeId === store.id);

      for (const med of storeMeds) {
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

  /**
   * Map PostgreSQL database row to normalized Medicine object
   */
  _mapDbRowToMedicine(row) {
    if (!row) return null;
    const stockQty = parseInt(row.stock_quantity ?? 0, 10);
    return {
      id: row.id,
      storeId: row.store_id || 'store-001',
      name: row.name,
      genericName: row.generic_name || '',
      category: row.category || 'General',
      batchNumber: row.batch_number || '',
      expiryDate: row.expiry_date || '',
      price: parseFloat(row.price || 0),
      stockQuantity: stockQty,
      reorderLevel: parseInt(row.reorder_level ?? 10, 10),
      inStock: stockQty > 0,
      locationRack: row.location_rack || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }

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

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const insertSql = `
            INSERT INTO medicines (id, store_id, name, generic_name, category, batch_number, expiry_date, price, stock_quantity, reorder_level, in_stock, location_rack, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO UPDATE SET
              store_id = EXCLUDED.store_id,
              name = EXCLUDED.name,
              generic_name = EXCLUDED.generic_name,
              category = EXCLUDED.category,
              batch_number = EXCLUDED.batch_number,
              expiry_date = EXCLUDED.expiry_date,
              price = EXCLUDED.price,
              stock_quantity = EXCLUDED.stock_quantity,
              reorder_level = EXCLUDED.reorder_level,
              in_stock = EXCLUDED.in_stock,
              location_rack = EXCLUDED.location_rack,
              updated_at = EXCLUDED.updated_at
            RETURNING *;
          `;
          const result = await pool.query(insertSql, [
            medicine.id,
            medicine.storeId,
            medicine.name,
            medicine.genericName,
            medicine.category,
            medicine.batchNumber,
            medicine.expiryDate,
            medicine.price,
            medicine.stockQuantity,
            medicine.reorderLevel,
            medicine.inStock,
            medicine.locationRack,
            medicine.createdAt,
            medicine.updatedAt
          ]);

          if (result.rows && result.rows.length > 0) {
            const savedMed = this._mapDbRowToMedicine(result.rows[0]);
            this.medicines.set(savedMed.id, savedMed);
            return savedMed;
          }
        }
      } catch (err) {
        console.warn('Postgres persist failed in addMedicine, falling back to in-memory:', err.message);
      }
    }

    this.medicines.set(id, medicine);
    return medicine;
  }

  async searchMedicines({ query, storeId } = {}) {
    const q = (query || '').trim().toLowerCase();

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          let sql = 'SELECT * FROM medicines WHERE 1=1';
          const params = [];
          let paramIdx = 1;

          if (storeId) {
            sql += ` AND store_id = $${paramIdx++}`;
            params.push(storeId);
          }

          if (q) {
            sql += ` AND (LOWER(name) LIKE $${paramIdx} OR LOWER(generic_name) LIKE $${paramIdx} OR LOWER(category) LIKE $${paramIdx})`;
            params.push(`%${q}%`);
            paramIdx++;
          }

          sql += ' ORDER BY created_at DESC';

          const res = await pool.query(sql, params);
          if (res.rows) {
            return res.rows.map((row) => this._mapDbRowToMedicine(row));
          }
        }
      } catch (err) {
        console.warn('Postgres searchMedicines failed, falling back:', err.message);
      }
    }

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

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const res = await pool.query('SELECT * FROM medicines WHERE id = $1 LIMIT 1', [id]);
          if (res.rows && res.rows.length > 0) {
            return this._mapDbRowToMedicine(res.rows[0]);
          }
          return null;
        }
      } catch (err) {
        console.warn('Postgres getMedicineById failed, falling back:', err.message);
      }
    }

    return this.medicines.get(id) || null;
  }

  async listMedicines({ storeId, category } = {}) {
    const targetCat = (category || '').trim().toLowerCase();

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          let sql = 'SELECT * FROM medicines WHERE 1=1';
          const params = [];
          let paramIdx = 1;

          if (storeId) {
            sql += ` AND store_id = $${paramIdx++}`;
            params.push(storeId);
          }

          if (targetCat && targetCat !== 'all') {
            sql += ` AND LOWER(category) = LOWER($${paramIdx++})`;
            params.push(targetCat);
          }

          sql += ' ORDER BY created_at DESC';

          const res = await pool.query(sql, params);
          if (res.rows) {
            return res.rows.map((row) => this._mapDbRowToMedicine(row));
          }
        }
      } catch (err) {
        console.warn('Postgres listMedicines failed, falling back:', err.message);
      }
    }

    const results = [];
    for (const medicine of this.medicines.values()) {
      if (storeId && medicine.storeId !== storeId) {
        continue;
      }
      if (targetCat && targetCat !== 'all' && (!medicine.category || medicine.category.toLowerCase() !== targetCat)) {
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
    if (!id) return null;

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const existing = await this.getMedicineById(id);
          if (!existing) return null;

          const updated = { ...existing };
          if (updateData.name !== undefined) {
            if (typeof updateData.name !== 'string' || updateData.name.trim() === '') {
              const err = new Error('Medicine name cannot be empty');
              err.statusCode = 400;
              throw err;
            }
            updated.name = updateData.name.trim();
          }
          if (updateData.genericName !== undefined) updated.genericName = (updateData.genericName || '').trim();
          if (updateData.category !== undefined) updated.category = (updateData.category || '').trim();
          if (updateData.batchNumber !== undefined) updated.batchNumber = (updateData.batchNumber || '').trim();
          if (updateData.expiryDate !== undefined) updated.expiryDate = updateData.expiryDate;
          if (updateData.price !== undefined) updated.price = Number(updateData.price);
          if (updateData.stockQuantity !== undefined) updated.stockQuantity = Number(updateData.stockQuantity);
          if (updateData.reorderLevel !== undefined) updated.reorderLevel = Number(updateData.reorderLevel);
          if (updateData.locationRack !== undefined) updated.locationRack = (updateData.locationRack || '').trim();
          if (updateData.storeId !== undefined) updated.storeId = updateData.storeId;
          updated.inStock = updated.stockQuantity > 0;
          updated.updatedAt = new Date().toISOString();

          const updateSql = `
            UPDATE medicines SET
              store_id = $1, name = $2, generic_name = $3, category = $4,
              batch_number = $5, expiry_date = $6, price = $7, stock_quantity = $8,
              reorder_level = $9, in_stock = $10, location_rack = $11, updated_at = $12
            WHERE id = $13
            RETURNING *;
          `;
          const res = await pool.query(updateSql, [
            updated.storeId, updated.name, updated.genericName, updated.category,
            updated.batchNumber, updated.expiryDate, updated.price, updated.stockQuantity,
            updated.reorderLevel, updated.inStock, updated.locationRack, updated.updatedAt,
            id
          ]);
          if (res.rows && res.rows.length > 0) {
            const saved = this._mapDbRowToMedicine(res.rows[0]);
            this.medicines.set(id, saved);
            return saved;
          }
        }
      } catch (err) {
        if (err.statusCode) throw err;
        console.warn('Postgres updateMedicine failed, falling back:', err.message);
      }
    }

    const medicine = this.medicines.get(id);
    if (!medicine) return null;

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
    if (updateData.price !== undefined) medicine.price = typeof updateData.price === 'number' ? updateData.price : Number(updateData.price);
    if (updateData.stockQuantity !== undefined) medicine.stockQuantity = typeof updateData.stockQuantity === 'number' ? updateData.stockQuantity : Number(updateData.stockQuantity);
    if (updateData.reorderLevel !== undefined) medicine.reorderLevel = typeof updateData.reorderLevel === 'number' ? updateData.reorderLevel : Number(updateData.reorderLevel);
    if (updateData.locationRack !== undefined) medicine.locationRack = (updateData.locationRack || '').trim();
    if (updateData.storeId !== undefined) medicine.storeId = updateData.storeId;

    medicine.inStock = updateData.inStock !== undefined ? Boolean(updateData.inStock) : medicine.stockQuantity > 0;
    medicine.updatedAt = new Date().toISOString();

    this.medicines.set(id, medicine);
    return medicine;
  }

  async adjustStock(id, { action, quantity, storeId } = {}) {
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

    if (!db.isMockMode()) {
      try {
        const pool = db.getPool() || db.initDb();
        if (pool) {
          const checkRes = await pool.query('SELECT * FROM medicines WHERE id = $1 LIMIT 1', [id]);
          if (!checkRes.rows || checkRes.rows.length === 0) {
            const err = new Error(`Medicine with id '${id}' not found`);
            err.statusCode = 404;
            throw err;
          }

          const current = this._mapDbRowToMedicine(checkRes.rows[0]);
          if (storeId && current.storeId !== storeId) {
            const err = new Error(`Medicine '${id}' does not belong to store '${storeId}'`);
            err.statusCode = 403;
            throw err;
          }

          let newStock = current.stockQuantity;
          if (act === 'DEDUCT') {
            if (current.stockQuantity < numQty) {
              const err = new Error(`Insufficient stock for medicine '${current.name}'. Available: ${current.stockQuantity}, Requested: ${numQty}`);
              err.statusCode = 409;
              throw err;
            }
            newStock -= numQty;
          } else {
            newStock += numQty;
          }

          const inStock = newStock > 0;
          const updatedAt = new Date().toISOString();

          const updateRes = await pool.query(
            'UPDATE medicines SET stock_quantity = $1, in_stock = $2, updated_at = $3 WHERE id = $4 RETURNING *',
            [newStock, inStock, updatedAt, id]
          );

          if (updateRes.rows && updateRes.rows.length > 0) {
            const updated = this._mapDbRowToMedicine(updateRes.rows[0]);
            this.medicines.set(id, updated);
            return updated;
          }
        }
      } catch (err) {
        if (err.statusCode) throw err;
        console.warn('Postgres adjustStock failed, falling back to in-memory:', err.message);
      }
    }

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
