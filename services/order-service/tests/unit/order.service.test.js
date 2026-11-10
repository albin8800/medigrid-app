const orderService = require('../../src/services/order.service');
const { OrderStatus, ALLOWED_TRANSITIONS } = require('../../src/services/order.service');

describe('OrderService Unit Tests', () => {
  beforeEach(() => {
    orderService.clear();
  });

  describe('Order Creation & Total Calculation', () => {
    it('should successfully create an order and calculate total correctly', async () => {
      const orderPayload = {
        customerId: 'cust-101',
        pharmacyId: 'pharma-202',
        deliveryAddress: {
          street: '123 Health Ave',
          city: 'Metropolis',
          zip: '10001'
        },
        items: [
          { medicine: 'Amoxicillin 500mg', quantity: 2, unitPrice: 12.5 },
          { medicine: 'Paracetamol 650mg', quantity: 3, unitPrice: 4.75 }
        ]
      };

      // 2 * 12.50 = 25.00
      // 3 * 4.75 = 14.25
      // Total = 39.25
      const order = await orderService.createOrder(orderPayload);

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.customerId).toBe('cust-101');
      expect(order.pharmacyId).toBe('pharma-202');
      expect(order.totalAmount).toBe(39.25);
      expect(order.status).toBe(OrderStatus.CONFIRMED);
      expect(order.items).toHaveLength(2);
      expect(order.items[0].subtotal).toBe(25.0);
      expect(order.items[1].subtotal).toBe(14.25);
      expect(order.createdAt).toBeDefined();
      expect(order.updatedAt).toBeDefined();
    });

    it('should support flat string deliveryAddress and name/price item field aliases', async () => {
      const orderPayload = {
        customerId: 'cust-102',
        pharmacyId: 'pharma-203',
        deliveryAddress: '456 Elm Street, Gotham',
        items: [
          { name: 'Ibuprofen 400mg', quantity: 1, price: 9.99 }
        ]
      };

      const order = await orderService.createOrder(orderPayload);

      expect(order.totalAmount).toBe(9.99);
      expect(order.items[0].medicine).toBe('Ibuprofen 400mg');
      expect(order.items[0].unitPrice).toBe(9.99);
      expect(order.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should reject order creation if customerId is missing', async () => {
      await expect(
        orderService.createOrder({
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: 5 }]
        })
      ).rejects.toThrow('Customer ID is required');
    });

    it('should reject order creation if pharmacyId is missing', async () => {
      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          deliveryAddress: '123 Street',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: 5 }]
        })
      ).rejects.toThrow('Pharmacy ID is required');
    });

    it('should reject order creation if deliveryAddress is missing', async () => {
      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: 5 }]
        })
      ).rejects.toThrow('Delivery address is required');
    });

    it('should reject order creation if items array is empty or not provided', async () => {
      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: []
        })
      ).rejects.toThrow('Order items must be a non-empty array');

      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street'
        })
      ).rejects.toThrow('Order items must be a non-empty array');
    });

    it('should reject item with invalid quantity or negative price', async () => {
      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: [{ medicine: 'Aspirin', quantity: 0, unitPrice: 5 }]
        })
      ).rejects.toThrow("Item 'Aspirin' quantity must be a positive integer");

      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: [{ medicine: 'Aspirin', quantity: -2, unitPrice: 5 }]
        })
      ).rejects.toThrow("Item 'Aspirin' quantity must be a positive integer");

      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: [{ medicine: 'Aspirin', quantity: 1, unitPrice: -5 }]
        })
      ).rejects.toThrow("Item 'Aspirin' unit price must be a non-negative number");
    });

    it('should reject item without medicine name', async () => {
      await expect(
        orderService.createOrder({
          customerId: 'cust-1',
          pharmacyId: 'pharma-1',
          deliveryAddress: '123 Street',
          items: [{ quantity: 2, unitPrice: 10 }]
        })
      ).rejects.toThrow('Item at index 0 is missing medicine name');
    });
  });

  describe('Order State Machine Transitions', () => {
    it('should validate allowed forward transitions', () => {
      expect(orderService.isValidTransition(OrderStatus.PENDING, OrderStatus.RESERVED)).toBe(true);
      expect(orderService.isValidTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
      expect(orderService.isValidTransition(OrderStatus.RESERVED, OrderStatus.CONFIRMED)).toBe(true);
      expect(orderService.isValidTransition(OrderStatus.RESERVED, OrderStatus.CANCELLED)).toBe(true);
      expect(orderService.isValidTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should reject invalid state transitions', () => {
      // Skipping RESERVED directly to CONFIRMED from PENDING is invalid
      expect(orderService.isValidTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(false);

      // Backwards transitions are invalid
      expect(orderService.isValidTransition(OrderStatus.CONFIRMED, OrderStatus.PENDING)).toBe(false);
      expect(orderService.isValidTransition(OrderStatus.CONFIRMED, OrderStatus.RESERVED)).toBe(false);
      expect(orderService.isValidTransition(OrderStatus.RESERVED, OrderStatus.PENDING)).toBe(false);

      // Transitions from terminal CANCELLED are invalid
      expect(orderService.isValidTransition(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
      expect(orderService.isValidTransition(OrderStatus.CANCELLED, OrderStatus.RESERVED)).toBe(false);
      expect(orderService.isValidTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
      expect(orderService.isValidTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('should throw error when calling transitionState with an invalid transition', () => {
      const mockOrder = {
        id: 'ord-123',
        status: OrderStatus.CONFIRMED
      };

      expect(() => {
        orderService.transitionState(mockOrder, OrderStatus.PENDING);
      }).toThrow('Invalid state transition from CONFIRMED to PENDING');

      expect(() => {
        orderService.transitionState({ status: OrderStatus.CANCELLED }, OrderStatus.CONFIRMED);
      }).toThrow('Invalid state transition from CANCELLED to CONFIRMED');
    });

    it('should update status and timestamp when transitionState succeeds', () => {
      const mockOrder = {
        id: 'ord-123',
        status: OrderStatus.PENDING
      };

      orderService.transitionState(mockOrder, OrderStatus.RESERVED);
      expect(mockOrder.status).toBe(OrderStatus.RESERVED);
      expect(mockOrder.updatedAt).toBeDefined();
    });
  });

  describe('Order Cancellation Logic', () => {
    it('should successfully cancel a confirmed order and record the cancellation reason', async () => {
      const order = await orderService.createOrder({
        customerId: 'cust-cancel-test',
        pharmacyId: 'pharma-1',
        deliveryAddress: '789 Maple Rd',
        items: [{ medicine: 'Cetirizine 10mg', quantity: 1, unitPrice: 8.5 }]
      });

      expect(order.status).toBe(OrderStatus.CONFIRMED);

      const cancelledOrder = await orderService.cancelOrder(order.id, 'Customer changed their mind');

      expect(cancelledOrder.id).toBe(order.id);
      expect(cancelledOrder.status).toBe(OrderStatus.CANCELLED);
      expect(cancelledOrder.cancellationReason).toBe('Customer changed their mind');

      // Verify that DB / store has the cancelled status
      const fetched = await orderService.getOrderById(order.id);
      expect(fetched.status).toBe(OrderStatus.CANCELLED);
      expect(fetched.cancellationReason).toBe('Customer changed their mind');
    });

    it('should reject cancelling an already cancelled order', async () => {
      const order = await orderService.createOrder({
        customerId: 'cust-cancel-test-2',
        pharmacyId: 'pharma-1',
        deliveryAddress: '789 Maple Rd',
        items: [{ medicine: 'Cetirizine 10mg', quantity: 1, unitPrice: 8.5 }]
      });

      await orderService.cancelOrder(order.id, 'First cancellation');

      await expect(
        orderService.cancelOrder(order.id, 'Second cancellation attempt')
      ).rejects.toThrow(`Order '${order.id}' is already cancelled`);
    });

    it('should throw 404 error when attempting to cancel a non-existent order', async () => {
      await expect(
        orderService.cancelOrder('non-existent-order-id', 'Test Reason')
      ).rejects.toThrow("Order with id 'non-existent-order-id' not found");
    });

    it('should trigger stock release callback when cancelling an order', async () => {
      const mockRelease = jest.fn().mockResolvedValue({ success: true });
      orderService.setStockReleaser(mockRelease);

      const order = await orderService.createOrder({
        customerId: 'cust-release-test',
        pharmacyId: 'pharma-stock-release',
        deliveryAddress: '101 Pine St',
        items: [{ medicine: 'Vitamin C 500mg', quantity: 2, unitPrice: 5.0 }]
      });

      await orderService.cancelOrder(order.id, 'Releasing stock');

      expect(mockRelease).toHaveBeenCalledTimes(1);
      expect(mockRelease).toHaveBeenCalledWith(
        'pharma-stock-release',
        expect.arrayContaining([
          expect.objectContaining({ medicine: 'Vitamin C 500mg', quantity: 2 })
        ])
      );
    });
  });

  describe('Stock Failure Handling', () => {
    it('should handle simulated stock failure: save order as CANCELLED and reject with 409', async () => {
      const orderPayload = {
        customerId: 'cust-out-of-stock',
        pharmacyId: 'pharma-no-stock',
        deliveryAddress: '404 Missing Ave',
        items: [
          { medicine: 'Rare Medicine', quantity: 10, unitPrice: 50.0, simulateStockFailure: true }
        ]
      };

      let thrownError = null;
      try {
        await orderService.createOrder(orderPayload);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError.statusCode).toBe(409);
      expect(thrownError.message).toContain('Stock reservation failed');
      expect(thrownError.order).toBeDefined();
      expect(thrownError.order.status).toBe(OrderStatus.CANCELLED);
      expect(thrownError.order.cancellationReason).toContain('Insufficient stock');

      // Verify that the order record was persisted with CANCELLED status in store
      const persisted = await orderService.getOrderById(thrownError.order.id);
      expect(persisted).toBeDefined();
      expect(persisted.status).toBe(OrderStatus.CANCELLED);
      expect(persisted.cancellationReason).toContain('Insufficient stock');
    });

    it('should handle custom stock checker stub failure', async () => {
      orderService.setStockChecker(async (pharmacyId, items) => {
        return {
          success: false,
          reason: 'Pharmacy closed for inventory audit'
        };
      });

      const orderPayload = {
        customerId: 'cust-audit',
        pharmacyId: 'pharma-audit',
        deliveryAddress: '555 Central Ave',
        items: [{ medicine: 'Metformin 500mg', quantity: 1, unitPrice: 10.0 }]
      };

      let error = null;
      try {
        await orderService.createOrder(orderPayload);
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.statusCode).toBe(409);
      expect(error.message).toContain('Pharmacy closed for inventory audit');
      expect(error.order.status).toBe(OrderStatus.CANCELLED);
    });

    it('should reject when item has availableStock less than requested quantity', async () => {
      const orderPayload = {
        customerId: 'cust-stock-qty',
        pharmacyId: 'pharma-qty',
        deliveryAddress: '321 Broad St',
        items: [
          { medicine: 'Omeprazole 20mg', quantity: 5, unitPrice: 15.0, availableStock: 2 }
        ]
      };

      await expect(orderService.createOrder(orderPayload)).rejects.toThrow(
        /Stock reservation failed.*Insufficient stock/
      );

      const cancelledOrders = await orderService.listOrders({ status: OrderStatus.CANCELLED });
      expect(cancelledOrders.length).toBeGreaterThan(0);
      expect(cancelledOrders[0].items[0].medicine).toBe('Omeprazole 20mg');
    });
  });

  describe('Order Retrieval & Admin Listing', () => {
    it('should return null when getOrderById is called with an unknown id', async () => {
      const result = await orderService.getOrderById('unknown-id');
      expect(result).toBeNull();
    });

    it('should list all orders and support filtering by status', async () => {
      // Create confirmed order 1
      const order1 = await orderService.createOrder({
        customerId: 'cust-filter-1',
        pharmacyId: 'pharma-1',
        deliveryAddress: 'Addr 1',
        items: [{ medicine: 'Med A', quantity: 1, unitPrice: 10 }]
      });

      // Create confirmed order 2
      const order2 = await orderService.createOrder({
        customerId: 'cust-filter-2',
        pharmacyId: 'pharma-2',
        deliveryAddress: 'Addr 2',
        items: [{ medicine: 'Med B', quantity: 1, unitPrice: 20 }]
      });

      // Cancel order 2
      await orderService.cancelOrder(order2.id, 'Customer cancellation');

      // List all orders
      const allOrders = await orderService.listOrders();
      expect(allOrders).toHaveLength(2);

      // Filter by CONFIRMED
      const confirmedOrders = await orderService.listOrders({ status: 'CONFIRMED' });
      expect(confirmedOrders).toHaveLength(1);
      expect(confirmedOrders[0].id).toBe(order1.id);

      // Filter by CANCELLED
      const cancelledOrders = await orderService.listOrders({ status: 'CANCELLED' });
      expect(cancelledOrders).toHaveLength(1);
      expect(cancelledOrders[0].id).toBe(order2.id);

      // Filter by customerId
      const cust1Orders = await orderService.listOrders({ customerId: 'cust-filter-1' });
      expect(cust1Orders).toHaveLength(1);
      expect(cust1Orders[0].id).toBe(order1.id);
    });
  });
});
