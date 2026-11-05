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

// Medicine Inventory & Public Search endpoints
router.get('/api/v1/medicines/search', pharmacyController.searchMedicines);
router.get('/api/v1/medicines', pharmacyController.listMedicines);
router.get('/api/v1/medicines/:id', pharmacyController.getMedicineById);
router.post('/api/v1/medicines', pharmacyController.addMedicine);
router.put('/api/v1/medicines/:id', pharmacyController.updateMedicine);
router.patch('/api/v1/medicines/:id/stock', pharmacyController.adjustStock);

module.exports = router;
