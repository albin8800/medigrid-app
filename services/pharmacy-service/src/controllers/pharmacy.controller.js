const pharmacyService = require('../services/pharmacy.service');
const { checkRedisStatus } = require('../config/redis');

/**
 * Liveness probe: returns UP status and timestamp
 */
async function getHealth(req, res) {
  return res.status(200).json({
    status: 'UP',
    service: 'pharmacy-service',
    timestamp: new Date().toISOString()
  });
}

/**
 * Readiness probe: checks dependencies connectivity
 */
async function getReadiness(req, res) {
  const redisInfo = await checkRedisStatus();
  return res.status(200).json({
    status: 'READY',
    service: 'pharmacy-service',
    timestamp: new Date().toISOString(),
    redis: redisInfo
  });
}

/**
 * Register/add a new pharmacy
 */
async function createPharmacy(req, res, next) {
  try {
    const pharmacy = await pharmacyService.registerPharmacy(req.body);
    return res.status(201).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    if (
      error.message.includes('required') ||
      error.message.includes('Latitude') ||
      error.message.includes('Longitude') ||
      error.message.includes('Valid coordinates')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Find nearby pharmacies by coordinates and radius
 */
async function getNearbyPharmacies(req, res, next) {
  try {
    const { latitude, longitude, lat, lng, radiusKm, radius, medicineName, medicine } = req.query;

    const results = await pharmacyService.findNearbyPharmacies({
      latitude,
      longitude,
      lat,
      lng,
      radiusKm,
      radius,
      medicineName,
      medicine
    });

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    if (
      error.message.includes('required') ||
      error.message.includes('Latitude') ||
      error.message.includes('Longitude') ||
      error.message.includes('Valid')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Get single pharmacy by ID
 */
async function getPharmacyById(req, res, next) {
  try {
    const { id } = req.params;
    const pharmacy = await pharmacyService.getPharmacyById(id);

    if (!pharmacy) {
      return res.status(404).json({
        success: false,
        error: `Pharmacy with id '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: pharmacy
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all pharmacies
 */
async function getAllPharmacies(req, res, next) {
  try {
    const pharmacies = await pharmacyService.getAllPharmacies();
    return res.status(200).json({
      success: true,
      count: pharmacies.length,
      data: pharmacies
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Public search for medicines by query and/or storeId
 */
async function searchMedicines(req, res, next) {
  try {
    const { query, q, storeId } = req.query;
    const results = await pharmacyService.searchMedicines({
      query: query || q,
      storeId
    });

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * List medicines optionally filtered by storeId and/or category
 */
async function listMedicines(req, res, next) {
  try {
    const { storeId, category } = req.query;
    const results = await pharmacyService.listMedicines({
      storeId,
      category
    });

    return res.status(200).json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get medicine by ID
 */
async function getMedicineById(req, res, next) {
  try {
    const { id } = req.params;
    const medicine = await pharmacyService.getMedicineById(id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        error: `Medicine with id '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Add a new medicine to catalog
 */
async function addMedicine(req, res, next) {
  try {
    const medicine = await pharmacyService.addMedicine(req.body);
    return res.status(201).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    if (
      error.statusCode === 400 ||
      error.message.includes('required') ||
      error.message.includes('invalid')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Update medicine by ID
 */
async function updateMedicine(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await pharmacyService.updateMedicine(id, req.body);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Medicine with id '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    if (error.statusCode === 400 || error.message.includes('empty')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Adjust medicine stock (DEDUCT or RESTOCK)
 */
async function adjustStock(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await pharmacyService.adjustStock(id, req.body);

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    if (error.statusCode === 409 || error.message.includes('Insufficient stock')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    if (error.statusCode === 404 || error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    if (
      error.statusCode === 400 ||
      error.message.includes('positive') ||
      error.message.includes('Invalid stock adjustment action')
    ) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

module.exports = {
  getHealth,
  getReadiness,
  createPharmacy,
  getNearbyPharmacies,
  getPharmacyById,
  getAllPharmacies,
  searchMedicines,
  listMedicines,
  getMedicineById,
  addMedicine,
  updateMedicine,
  adjustStock
};
