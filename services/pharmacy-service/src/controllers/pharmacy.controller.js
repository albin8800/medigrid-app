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

module.exports = {
  getHealth,
  getReadiness,
  createPharmacy,
  getNearbyPharmacies,
  getPharmacyById,
  getAllPharmacies
};
