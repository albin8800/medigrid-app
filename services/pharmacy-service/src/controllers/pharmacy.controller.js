const pharmacyService = require('../services/pharmacy.service');
const { checkRedisStatus } = require('../config/redis');
const { checkDbStatus } = require('../config/db');

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
  const dbInfo = await checkDbStatus();
  return res.status(200).json({
    status: 'READY',
    service: 'pharmacy-service',
    timestamp: new Date().toISOString(),
    redis: redisInfo,
    database: dbInfo
  });
}

/**
 * Prometheus metrics probe
 */
async function getMetrics(req, res) {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  const dbInfo = await checkDbStatus();
  const redisInfo = await checkRedisStatus();

  const metrics = [
    `# HELP medigrid_service_uptime_seconds Total service uptime in seconds`,
    `# TYPE medigrid_service_uptime_seconds gauge`,
    `medigrid_service_uptime_seconds{service="pharmacy-service"} ${uptime.toFixed(2)}`,
    ``,
    `# HELP medigrid_memory_bytes Memory usage in bytes`,
    `# TYPE medigrid_memory_bytes gauge`,
    `medigrid_memory_bytes{service="pharmacy-service",type="rss"} ${memUsage.rss}`,
    `medigrid_memory_bytes{service="pharmacy-service",type="heapUsed"} ${memUsage.heapUsed}`,
    `medigrid_memory_bytes{service="pharmacy-service",type="heapTotal"} ${memUsage.heapTotal}`,
    ``,
    `# HELP medigrid_dependency_status Status of backing dependencies (1 = UP, 0 = DOWN)`,
    `# TYPE medigrid_dependency_status gauge`,
    `medigrid_dependency_status{service="pharmacy-service",dependency="database"} ${dbInfo.status === 'UP' ? 1 : 0}`,
    `medigrid_dependency_status{service="pharmacy-service",dependency="redis"} ${redisInfo.status === 'UP' ? 1 : 0}`,
    ``,
    `# HELP medigrid_http_requests_total Total number of HTTP requests processed`,
    `# TYPE medigrid_http_requests_total counter`,
    `medigrid_http_requests_total{service="pharmacy-service",status="200"} 1`,
    ``
  ].join('\n');

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(metrics);
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
    const storeId = req.body.storeId || req.query.storeId || req.headers['x-store-id'];
    const medicine = await pharmacyService.addMedicine({
      ...req.body,
      ...(storeId ? { storeId } : {})
    });
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
    const storeId = req.body.storeId || req.query.storeId || req.headers['x-store-id'];
    const updated = await pharmacyService.adjustStock(id, {
      ...req.body,
      ...(storeId ? { storeId } : {})
    });

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    if (error.statusCode === 403 || error.message.includes('does not belong to store')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
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

/**
 * Store login endpoint: POST /api/v1/auth/store/login
 */
async function storeLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await pharmacyService.loginStore(email, password);
    return res.status(200).json({
      success: true,
      token: result.token,
      store: result.store
    });
  } catch (error) {
    if (error.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Super Admin login endpoint: POST /api/v1/auth/admin/login
 */
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    const result = await pharmacyService.loginAdmin(email, password);
    return res.status(200).json({
      success: true,
      token: result.token,
      admin: result.admin
    });
  } catch (error) {
    if (error.statusCode === 401) {
      return res.status(401).json({
        success: false,
        error: error.message
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Public Location-Based Medicine Discovery: GET /api/v1/public/search
 */
async function publicSearch(req, res, next) {
  try {
    const { medicine, q, medicineName, query, lat, latitude, lng, longitude, radius, radiusKm, city } = req.query;

    const results = await pharmacyService.publicSearchMedicines({
      medicine: medicine || q || medicineName || query,
      lat: lat ?? latitude,
      lng: lng ?? longitude,
      radius: radius ?? radiusKm,
      city
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
 * List registered medical stores: GET /api/v1/admin/stores
 */
async function listStores(req, res, next) {
  try {
    const { status, search, q } = req.query;
    const stores = await pharmacyService.listStores({
      status,
      search: search || q
    });

    return res.status(200).json({
      success: true,
      count: stores.length,
      data: stores
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Onboard a new medical store: POST /api/v1/admin/stores
 */
async function createStore(req, res, next) {
  try {
    const store = await pharmacyService.registerStore(req.body);
    return res.status(201).json({
      success: true,
      data: store
    });
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    if (
      error.statusCode === 400 ||
      error.message.includes('required') ||
      error.message.includes('coordinates') ||
      error.message.includes('Latitude') ||
      error.message.includes('Longitude')
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
 * Change store status: PATCH /api/v1/admin/stores/:id/status
 */
async function updateStoreStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const updated = await pharmacyService.updateStoreStatus(id, status);

    return res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
    return next(error);
  }
}

/**
 * Get store by ID: GET /api/v1/admin/stores/:id
 */
async function getStore(req, res, next) {
  try {
    const { id } = req.params;
    const store = await pharmacyService.getStoreById(id);
    if (!store) {
      return res.status(404).json({
        success: false,
        error: `Store with id '${id}' not found`
      });
    }
    return res.status(200).json({
      success: true,
      data: store
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Delete a store: DELETE /api/v1/admin/stores/:id
 */
async function deleteStore(req, res, next) {
  try {
    const { id } = req.params;
    await pharmacyService.deleteStore(id);

    return res.status(200).json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
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
  getMetrics,
  createPharmacy,
  getNearbyPharmacies,
  getPharmacyById,
  getAllPharmacies,
  searchMedicines,
  listMedicines,
  getMedicineById,
  addMedicine,
  updateMedicine,
  adjustStock,
  storeLogin,
  adminLogin,
  publicSearch,
  listStores,
  getStore,
  createStore,
  updateStoreStatus,
  deleteStore
};
