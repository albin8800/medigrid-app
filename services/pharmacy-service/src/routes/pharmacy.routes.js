const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');

// Liveness probe
router.get('/healthz', pharmacyController.getHealth);

// Readiness probe
router.get('/ready', pharmacyController.getReadiness);

// Pharmacy API endpoints
router.post('/api/v1/pharmacies', pharmacyController.createPharmacy);
router.get('/api/v1/pharmacies/nearby', pharmacyController.getNearbyPharmacies);
router.get('/api/v1/pharmacies/:id', pharmacyController.getPharmacyById);
router.get('/api/v1/pharmacies', pharmacyController.getAllPharmacies);

module.exports = router;
