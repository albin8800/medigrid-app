const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');

// Health & Readiness probes
router.get('/healthz', orderController.getHealth);
router.get('/ready', orderController.getReadiness);

// Order management endpoints
router.post('/api/v1/orders', orderController.createOrder);
router.get('/api/v1/orders/:id', orderController.getOrderById);
router.patch('/api/v1/orders/:id/cancel', orderController.cancelOrder);
router.get('/api/v1/orders', orderController.listOrders);

module.exports = router;
