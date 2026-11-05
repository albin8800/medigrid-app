const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/services/order.service');
const { closeDb } = require('../../src/config/db');

/**
 * SDET Contract & Negative Edge-Case Integration Test Suite
 * Covers strict API contracts, input boundaries, conflict handling,
 * state transitions, admin listing/filtering, and operational probes.
 */
describe('SDET Order Service API Contract & Edge-Case Test Suite', () => {
  beforeEach(() => {
    orderService.clear();
  });

  afterAll(async () => {
    await closeDb();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Payload Validation Rejection
  // ---------------------------------------------------------------------------
  describe('Test 1: Payload validation rejection (POST /api/v1/orders)', () => {
    const validBasePayload = {
      customerId: 'cust-valid-001',
      pharmacyId: 'pharm-valid-001',
      deliveryAddress: {
        street: '742 Evergreen Terrace',
        city: 'Springfield',
        zip: '97477'
      },
      items: [
        { medicine: 'Amoxicillin 500mg', quantity: 2, unitPrice: 12.5 }
      ]
    };

    it('should reject with 400 when customerId is missing or blank', async () => {
      // 1. Missing customerId
      const noCust = { ...validBasePayload };
      delete noCust.customerId;

      const resNoCust = await request(app)
        .post('/api/v1/orders')
        .send(noCust);

      expect(resNoCust.status).toBe(400);
      expect(resNoCust.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/customer id is required/i)
      });

      // 2. Blank customerId
      const emptyCust = { ...validBasePayload, customerId: '   ' };
      const resEmptyCust = await request(app)
        .post('/api/v1/orders')
        .send(emptyCust);

      expect(resEmptyCust.status).toBe(400);
      expect(resEmptyCust.body.success).toBe(false);
      expect(resEmptyCust.body.error).toMatch(/customer id is required/i);
    });

    it('should reject with 400 when pharmacyId is missing or blank', async () => {
      // 1. Missing pharmacyId
      const noPharm = { ...validBasePayload };
      delete noPharm.pharmacyId;

      const resNoPharm = await request(app)
        .post('/api/v1/orders')
        .send(noPharm);

      expect(resNoPharm.status).toBe(400);
      expect(resNoPharm.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/pharmacy id is required/i)
      });

      // 2. Blank pharmacyId
      const emptyPharm = { ...validBasePayload, pharmacyId: '' };
      const resEmptyPharm = await request(app)
        .post('/api/v1/orders')
        .send(emptyPharm);

      expect(resEmptyPharm.status).toBe(400);
      expect(resEmptyPharm.body.success).toBe(false);
      expect(resEmptyPharm.body.error).toMatch(/pharmacy id is required/i);
    });

    it('should reject with 400 when deliveryAddress is missing or blank', async () => {
      const noAddress = { ...validBasePayload };
      delete noAddress.deliveryAddress;

      const resNoAddress = await request(app)
        .post('/api/v1/orders')
        .send(noAddress);

      expect(resNoAddress.status).toBe(400);
      expect(resNoAddress.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/delivery address is required/i)
      });

      const emptyAddress = { ...validBasePayload, deliveryAddress: '   ' };
      const resEmptyAddress = await request(app)
        .post('/api/v1/orders')
        .send(emptyAddress);

      expect(resEmptyAddress.status).toBe(400);
      expect(resEmptyAddress.body.success).toBe(false);
      expect(resEmptyAddress.body.error).toMatch(/delivery address is required/i);
    });

    it('should reject with 400 when items array is missing or empty', async () => {
      // 1. Empty array
      const emptyItems = { ...validBasePayload, items: [] };
      const resEmpty = await request(app)
        .post('/api/v1/orders')
        .send(emptyItems);

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/items must be a non-empty array/i)
      });

      // 2. Items not an array (null or undefined)
      const noItems = { ...validBasePayload };
      delete noItems.items;

      const resNull = await request(app)
        .post('/api/v1/orders')
        .send(noItems);

      expect(resNull.status).toBe(400);
      expect(resNull.body.success).toBe(false);
      expect(resNull.body.error).toMatch(/items must be a non-empty array/i);
    });

    it('should reject with 400 when item medicine name is missing or blank', async () => {
      // 1. Missing medicine property
      const missingMed = {
        ...validBasePayload,
        items: [{ quantity: 2, unitPrice: 10.0 }]
      };
      const resMissingMed = await request(app)
        .post('/api/v1/orders')
        .send(missingMed);

      expect(resMissingMed.status).toBe(400);
      expect(resMissingMed.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/missing medicine name/i)
      });

      // 2. Blank medicine name
      const blankMed = {
        ...validBasePayload,
        items: [{ medicine: '   ', quantity: 2, unitPrice: 10.0 }]
      };
      const resBlankMed = await request(app)
        .post('/api/v1/orders')
        .send(blankMed);

      expect(resBlankMed.status).toBe(400);
      expect(resBlankMed.body.success).toBe(false);
      expect(resBlankMed.body.error).toMatch(/missing medicine name/i);
    });

    it('should reject with 400 when quantity is negative, zero, or non-integer', async () => {
      // 1. Negative quantity
      const negativeQty = {
        ...validBasePayload,
        items: [{ medicine: 'Ibuprofen', quantity: -3, unitPrice: 8.0 }]
      };
      const resNeg = await request(app)
        .post('/api/v1/orders')
        .send(negativeQty);

      expect(resNeg.status).toBe(400);
      expect(resNeg.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/positive integer/i)
      });

      // 2. Zero quantity
      const zeroQty = {
        ...validBasePayload,
        items: [{ medicine: 'Ibuprofen', quantity: 0, unitPrice: 8.0 }]
      };
      const resZero = await request(app)
        .post('/api/v1/orders')
        .send(zeroQty);

      expect(resZero.status).toBe(400);
      expect(resZero.body.success).toBe(false);
      expect(resZero.body.error).toMatch(/positive integer/i);

      // 3. Floating-point non-integer quantity
      const floatQty = {
        ...validBasePayload,
        items: [{ medicine: 'Ibuprofen', quantity: 2.7, unitPrice: 8.0 }]
      };
      const resFloat = await request(app)
        .post('/api/v1/orders')
        .send(floatQty);

      expect(resFloat.status).toBe(400);
      expect(resFloat.body.success).toBe(false);
      expect(resFloat.body.error).toMatch(/positive integer/i);
    });

    it('should reject with 400 when unitPrice is negative', async () => {
      const negativePrice = {
        ...validBasePayload,
        items: [{ medicine: 'Paracetamol', quantity: 1, unitPrice: -4.5 }]
      };
      const res = await request(app)
        .post('/api/v1/orders')
        .send(negativePrice);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        error: expect.stringMatching(/non-negative number/i)
      });
    });

    it('should create order and return 201 with verified contract schema on valid input', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send(validBasePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();

      const order = res.body.data;
      expect(typeof order.id).toBe('string');
      expect(order.id.length).toBeGreaterThan(0);
      expect(order.customerId).toBe(validBasePayload.customerId);
      expect(order.pharmacyId).toBe(validBasePayload.pharmacyId);
      expect(order.status).toBe('CONFIRMED');
      expect(order.totalAmount).toBe(25.0);
      expect(Array.isArray(order.items)).toBe(true);
      expect(order.items[0]).toMatchObject({
        medicine: 'Amoxicillin 500mg',
        quantity: 2,
        unitPrice: 12.5,
        subtotal: 25.0
      });
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: Stock Rejection Handling (simulate out-of-stock medicine)
  // ---------------------------------------------------------------------------
  describe('Test 2: Stock rejection handling (POST /api/v1/orders)', () => {
    it('should return 409 Conflict when item has simulateStockFailure flag set', async () => {
      const outOfStockPayload = {
        customerId: 'cust-stock-out',
        pharmacyId: 'pharm-stock-out',
        deliveryAddress: '55 Cold Storage Rd',
        items: [
          {
            medicine: 'Specialty Vaccine',
            quantity: 1,
            unitPrice: 150.0,
            simulateStockFailure: true
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(outOfStockPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Stock reservation failed/i);
      expect(res.body.error).toMatch(/Specialty Vaccine/i);

      // Verify that the failed order was persisted with CANCELLED status
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancellationReason).toMatch(/Specialty Vaccine/i);

      // Verify order can be retrieved and reflects CANCELLED state
      const checkRes = await request(app).get(`/api/v1/orders/${res.body.data.id}`);
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.status).toBe('CANCELLED');
    });

    it('should return 409 Conflict when availableStock is less than requested quantity', async () => {
      const stockDeficitPayload = {
        customerId: 'cust-stock-deficit',
        pharmacyId: 'pharm-central',
        deliveryAddress: '88 Clinic Way',
        items: [
          {
            medicine: 'Amoxicillin',
            quantity: 10,
            unitPrice: 5.0,
            availableStock: 3 // Only 3 in stock, requested 10
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(stockDeficitPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Stock reservation failed');
      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should return 409 Conflict when custom stockChecker rejects reservation', async () => {
      // Register custom stock checker simulating inventory exhaustion
      orderService.setStockChecker(async (pharmacyId, items) => {
        return {
          success: false,
          reason: `Pharmacy '${pharmacyId}' has zero inventory for warehouse allocation`
        };
      });

      const payload = {
        customerId: 'cust-custom-check',
        pharmacyId: 'pharm-exhausted',
        deliveryAddress: '99 Medical Park',
        items: [
          { medicine: 'Insulin Glargine', quantity: 2, unitPrice: 45.0 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/orders')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Stock reservation failed');
      expect(res.body.error).toContain('zero inventory for warehouse allocation');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 3: Not Found Handling
  // ---------------------------------------------------------------------------
  describe('Test 3: Not Found handling (GET /api/v1/orders/invalid-order-id-999)', () => {
    it('should return HTTP 404 Not Found for non-existent order ID', async () => {
      const nonExistentId = 'invalid-order-id-999';

      const res = await request(app).get(`/api/v1/orders/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        success: false,
        error: `Order with id '${nonExistentId}' not found`
      });
    });

    it('should return HTTP 404 Not Found for arbitrary UUID that does not exist', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';

      const res = await request(app).get(`/api/v1/orders/${randomUuid}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain(randomUuid);
      expect(res.body.error).toContain('not found');
    });
  });

  // ---------------------------------------------------------------------------
  // Test 4: Cancellation Boundary Tests
  // ---------------------------------------------------------------------------
  describe('Test 4: Cancellation boundary tests (PATCH /api/v1/orders/:id/cancel)', () => {
    it('should transition order status to CANCELLED on valid cancellation (HTTP 200)', async () => {
      // 1. Create confirmed order
      const order = await orderService.createOrder({
        customerId: 'cust-cancel-test',
        pharmacyId: 'pharm-cancel-test',
        deliveryAddress: '101 Healing Blvd',
        items: [{ medicine: 'Azithromycin', quantity: 1, unitPrice: 22.0 }]
      });

      expect(order.status).toBe('CONFIRMED');

      // 2. Perform cancellation
      const cancelReason = 'Customer requested prescription change';
      const res = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: cancelReason });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order cancelled successfully');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.status).toBe('CANCELLED');
      expect(res.body.data.cancellationReason).toBe(cancelReason);

      // 3. Verify order persists in CANCELLED state via GET
      const getRes = await request(app).get(`/api/v1/orders/${order.id}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.status).toBe('CANCELLED');
      expect(getRes.body.data.cancellationReason).toBe(cancelReason);
    });

    it('should return HTTP 400 Bad Request on subsequent cancellation of already cancelled order', async () => {
      // 1. Create order
      const order = await orderService.createOrder({
        customerId: 'cust-double-cancel',
        pharmacyId: 'pharm-cancel-test',
        deliveryAddress: '102 Healing Blvd',
        items: [{ medicine: 'Omeprazole', quantity: 2, unitPrice: 14.0 }]
      });

      // 2. First cancellation (successful)
      const firstCancelRes = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: 'Initial cancellation' });

      expect(firstCancelRes.status).toBe(200);
      expect(firstCancelRes.body.data.status).toBe('CANCELLED');

      // 3. Subsequent cancellation attempt
      const secondCancelRes = await request(app)
        .patch(`/api/v1/orders/${order.id}/cancel`)
        .send({ reason: 'Second cancellation attempt' });

      expect(secondCancelRes.status).toBe(400);
      expect(secondCancelRes.body.success).toBe(false);
      expect(secondCancelRes.body.error).toContain('already cancelled');
    });

    it('should return HTTP 404 Not Found when cancelling a non-existent order', async () => {
      const nonExistentOrderId = 'order-ghost-404';

      const res = await request(app)
        .patch(`/api/v1/orders/${nonExistentOrderId}/cancel`)
        .send({ reason: 'Trying to cancel missing order' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain(`Order with id '${nonExistentOrderId}' not found`);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 5: Admin Order Listing & Filtering
  // ---------------------------------------------------------------------------
  describe('Test 5: Admin order listing & filtering (GET /api/v1/orders)', () => {
    let orderConfirmed1;
    let orderConfirmed2;
    let orderCancelled1;
    let orderCancelled2;

    beforeEach(async () => {
      // Seed Order 1: CONFIRMED
      orderConfirmed1 = await orderService.createOrder({
        customerId: 'cust-admin-1',
        pharmacyId: 'pharm-alpha',
        deliveryAddress: 'Suite 100, Med Tower',
        items: [{ medicine: 'Lisinopril', quantity: 1, unitPrice: 18.0 }]
      });

      // Seed Order 2: CONFIRMED
      orderConfirmed2 = await orderService.createOrder({
        customerId: 'cust-admin-2',
        pharmacyId: 'pharm-beta',
        deliveryAddress: 'Suite 200, Med Tower',
        items: [{ medicine: 'Metformin', quantity: 3, unitPrice: 7.5 }]
      });

      // Seed Order 3: Cancelled manually after creation
      orderCancelled1 = await orderService.createOrder({
        customerId: 'cust-admin-3',
        pharmacyId: 'pharm-alpha',
        deliveryAddress: 'Suite 300, Med Tower',
        items: [{ medicine: 'Atorvastatin', quantity: 1, unitPrice: 25.0 }]
      });
      await orderService.cancelOrder(orderCancelled1.id, 'Prescription cancelled by physician');

      // Seed Order 4: Cancelled due to simulated stock rejection
      try {
        await orderService.createOrder({
          customerId: 'cust-admin-4',
          pharmacyId: 'pharm-gamma',
          deliveryAddress: 'Suite 400, Med Tower',
          items: [
            { medicine: 'Rare Antibiotic', quantity: 1, unitPrice: 85.0, simulateStockFailure: true }
          ]
        });
      } catch (err) {
        orderCancelled2 = err.order;
      }
    });

    it('should return all orders when no status filter is applied', async () => {
      const res = await request(app).get('/api/v1/orders');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(4);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(4);

      const returnedIds = res.body.data.map((o) => o.id);
      expect(returnedIds).toContain(orderConfirmed1.id);
      expect(returnedIds).toContain(orderConfirmed2.id);
      expect(returnedIds).toContain(orderCancelled1.id);
      expect(returnedIds).toContain(orderCancelled2.id);
    });

    it('should filter only CONFIRMED orders when query param status=CONFIRMED', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);

      // Verify each item has status CONFIRMED
      res.body.data.forEach((order) => {
        expect(order.status).toBe('CONFIRMED');
      });

      const confirmedIds = res.body.data.map((o) => o.id);
      expect(confirmedIds).toContain(orderConfirmed1.id);
      expect(confirmedIds).toContain(orderConfirmed2.id);
      expect(confirmedIds).not.toContain(orderCancelled1.id);
      expect(confirmedIds).not.toContain(orderCancelled2.id);
    });

    it('should filter only CANCELLED orders when query param status=CANCELLED', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);

      // Verify each item has status CANCELLED
      res.body.data.forEach((order) => {
        expect(order.status).toBe('CANCELLED');
      });

      const cancelledIds = res.body.data.map((o) => o.id);
      expect(cancelledIds).toContain(orderCancelled1.id);
      expect(cancelledIds).toContain(orderCancelled2.id);
      expect(cancelledIds).not.toContain(orderConfirmed1.id);
      expect(cancelledIds).not.toContain(orderConfirmed2.id);
    });

    it('should filter orders by pharmacyId and customerId query parameters', async () => {
      // 1. By pharmacyId
      const resPharm = await request(app)
        .get('/api/v1/orders')
        .query({ pharmacyId: 'pharm-alpha' });

      expect(resPharm.status).toBe(200);
      expect(resPharm.body.count).toBe(2);
      resPharm.body.data.forEach((order) => {
        expect(order.pharmacyId).toBe('pharm-alpha');
      });

      // 2. By customerId
      const resCust = await request(app)
        .get('/api/v1/orders')
        .query({ customerId: 'cust-admin-1' });

      expect(resCust.status).toBe(200);
      expect(resCust.body.count).toBe(1);
      expect(resCust.body.data[0].id).toBe(orderConfirmed1.id);
    });

    it('should return empty list when filter matches no orders', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .query({ status: 'NON_EXISTENT_STATUS' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Test 6: Probe Verification (GET /healthz and GET /ready)
  // ---------------------------------------------------------------------------
  describe('Test 6: Probe verification (/healthz & /ready)', () => {
    describe('GET /healthz (Liveness Probe)', () => {
      it('should return HTTP 200 with valid liveness JSON schema', async () => {
        const res = await request(app).get('/healthz');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/json/);

        // Strict contract verification
        expect(res.body).toMatchObject({
          status: 'UP',
          service: 'order-service'
        });

        // Timestamp must be a valid ISO 8601 string
        expect(typeof res.body.timestamp).toBe('string');
        const parsedDate = new Date(res.body.timestamp);
        expect(parsedDate.toISOString()).toBe(res.body.timestamp);
      });
    });

    describe('GET /ready (Readiness Probe)', () => {
      it('should return HTTP 200 with valid readiness JSON schema', async () => {
        const res = await request(app).get('/ready');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/json/);

        // Strict contract verification
        expect(res.body).toMatchObject({
          status: 'READY',
          service: 'order-service',
          database: {
            connected: true
          }
        });

        // Timestamp must be a valid ISO 8601 string
        expect(typeof res.body.timestamp).toBe('string');
        const parsedDate = new Date(res.body.timestamp);
        expect(parsedDate.toISOString()).toBe(res.body.timestamp);

        // Database object structure
        expect(typeof res.body.database.status).toBe('string');
        expect(typeof res.body.database.type).toBe('string');
      });
    });
  });
});
