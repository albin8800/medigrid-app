const crypto = require('crypto');
const { initRedis, isRedisConnected } = require('../config/redis');

class PharmacyService {
  constructor() {
    this.pharmacies = new Map();
    this.REDIS_GEO_KEY = 'pharmacies:geo';
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
   * Clear in-memory storage (useful for testing)
   */
  clear() {
    this.pharmacies.clear();
  }
}

// Singleton instance
module.exports = new PharmacyService();
