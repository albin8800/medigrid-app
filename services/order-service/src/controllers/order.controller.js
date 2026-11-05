const orderService = require('../services/order.service');
const { checkDbStatus } = require('../config/db');

/**
 * Liveness probe: returns HTTP 200 { status: 'UP', service: 'order-service', timestamp }
 */
async function getHealth(req, res) {
  return res.status(200).json({
    status: 'UP',
    service: 'order-service',
    timestamp: new Date().toISOString()
  });
}

/**
 * Readiness probe: checks DB pool or returns ready
 */
async function getReadiness(req, res) {
  const dbStatus = await checkDbStatus();
  const isReady = dbStatus && dbStatus.connected !== false;

  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'READY' : 'NOT_READY',
    service: 'order-service',
    timestamp: new Date().toISOString(),
    database: dbStatus
  });
}

/**
 * POST /api/v1/orders: Handles order placement (returns 201 Created or 400/409)
 */
async function createOrder(req, res, next) {
  try {
    const order = await orderService.createOrder(req.body);
    return res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    if (
      error.statusCode === 409 ||
      error.message.includes('Stock reservation failed') ||
      error.message.includes('Insufficient stock')
    ) {
      return res.status(409).json({
        success: false,
        error: error.message,
        ...(error.order ? { data: error.order } : {})
      });
    }

    if (
      error.statusCode === 400 ||
      error.message.includes('required') ||
      error.message.includes('must be') ||
      error.message.includes('missing') ||
      error.message.includes('array')
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
 * GET /api/v1/orders/:id: Fetches order details (200 or 404)
 */
async function getOrderById(req, res, next) {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order with id '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/v1/orders/:id/cancel: Handles cancellation
 */
async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const order = await orderService.cancelOrder(id, reason);
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    if (error.statusCode === 404 || error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (
      error.statusCode === 400 ||
      error.message.includes('already cancelled') ||
      error.message.includes('Invalid state transition')
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
 * GET /api/v1/orders: Lists orders for admin dashboard
 */
async function listOrders(req, res, next) {
  try {
    const { status, customerId, pharmacyId } = req.query;
    const orders = await orderService.listOrders({
      status,
      customerId,
      pharmacyId
    });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/bills: Create in-store POS bill and invoice
 */
async function createBill(req, res, next) {
  try {
    const bill = await orderService.createBill(req.body);
    return res.status(201).json({
      success: true,
      data: bill
    });
  } catch (error) {
    if (error.statusCode === 403 || error.message.includes('suspended')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    if (
      error.statusCode === 409 ||
      error.message.includes('Insufficient stock') ||
      error.message.includes('Stock deduction failed')
    ) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    if (
      error.statusCode === 400 ||
      error.message.includes('required') ||
      error.message.includes('must be') ||
      error.message.includes('missing') ||
      error.message.includes('array')
    ) {
      return res.status(400).json({
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

    return next(error);
  }
}

/**
 * GET /api/v1/bills/:id: Get bill details by billId
 */
async function getBillById(req, res, next) {
  try {
    const { id } = req.params;
    const bill = await orderService.getBillById(id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        error: `Bill with id '${id}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/bills: List bills with aggregate metrics
 */
async function listBills(req, res, next) {
  try {
    const { storeId } = req.query;
    const result = await orderService.listBills({ storeId });

    return res.status(200).json({
      success: true,
      count: result.count,
      totalRevenue: result.totalRevenue,
      data: result.bills
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/admin/analytics: Platform-wide sales analytics aggregating total stores, total revenue, and top-selling medicines
 */
async function getPlatformAnalytics(req, res, next) {
  try {
    const analytics = await orderService.getPlatformAnalytics();
    return res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getHealth,
  getReadiness,
  createOrder,
  getOrderById,
  cancelOrder,
  listOrders,
  createBill,
  getBillById,
  listBills,
  getPlatformAnalytics
};
