import express from 'express';
import * as db from '../db/database.js';
import {
  optionalAuth,
  requireAuth,
  requireCustomerIdentity,
} from '../middleware/auth.js';
import { orderRateLimit } from '../middleware/rateLimit.js';
import { validateOrderCreation, validateOrderStatus } from '../validators/schemas.js';
import { sanitizeOrderData, sanitizeText } from '../utils/sanitize.js';
import { sendOrderConfirmation, sendOrderReadyNotification, sendOrderCancellation } from '../services/email.js';
import { schedulePickupReminderAfterReady } from '../services/pickupReminder.js';
import {
  OrderPricingError,
  hashOrderRequest,
  normalizeOrderRequest,
  validateAndPriceOrder,
} from '../services/orderPricing.js';

const router = express.Router();
const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

function publicIdFromRequest(req, res) {
  const publicId = req.params.id;
  if (!PUBLIC_ID_PATTERN.test(publicId || '')) {
    res.status(404).json({ message: 'Order not found' });
    return null;
  }
  return publicId;
}

function actorSubject(req) {
  return req.auth?.sub || req.auth?.subject || null;
}

function customerOrderView(order) {
  if (!order) return null;
  const {
    id,
    customer_id: customerId,
    idempotency_key: idempotencyKey,
    request_hash: requestHash,
    ...safeOrder
  } = order;
  safeOrder.items = (order.items || []).map((item) => {
    const { id: itemId, order_id: orderId, ...safeItem } = item;
    return safeItem;
  });
  return safeOrder;
}

function emitOrderChange(req, order, eventName = 'order-updated') {
  const io = req.app.get('io');
  if (!io || !order) return;
  // All sockets are authenticated staff sockets. Customer status refreshes use
  // the ownership-checked HTTP endpoint instead of a global broadcast.
  io.to('staff').emit(eventName, order);
}

async function requireCustomerOrStaff(req, res, next) {
  if (req.auth?.role === 'admin') return next();
  return requireCustomerIdentity(req, res, next);
}

// Create an order. Identity, idempotency, product availability, modifier
// cardinality, and all money values are server-authoritative.
router.post('/', orderRateLimit, requireCustomerIdentity, (req, res) => {
  try {
    if (db.getSetting('kitchen_open') === 'false') {
      const message = db.getSetting('kitchen_closed_message')
        || 'Online ordering is temporarily paused. Please try again soon.';
      return res.status(503).json({ message, kitchenClosed: true });
    }

    const validation = validateOrderCreation(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid order data', errors: validation.errors });
    }

    const sanitized = sanitizeOrderData(validation.data);
    if (!sanitized.customerName || sanitized.items.length === 0) {
      return res.status(400).json({ message: 'Customer name and items are required' });
    }

    const idempotencyKey = req.get('Idempotency-Key');
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey || '')) {
      return res.status(400).json({
        message: 'A valid Idempotency-Key header is required',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const customer = db.getOrCreateCustomer(req.customerIdentity.subject);
    // Resolve idempotency against the canonical request body before touching
    // the live catalog. Exact retries remain replayable after a menu change;
    // a changed body still conflicts without leaking catalog details.
    const requestHash = hashOrderRequest(normalizeOrderRequest(sanitized));
    const existing = db.getOrderByIdempotency(customer.id, idempotencyKey);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return res.status(409).json({
          message: 'This idempotency key was already used with a different order payload',
          code: 'IDEMPOTENCY_KEY_CONFLICT',
        });
      }
      return res.status(200).json({
        id: existing.public_id,
        public_id: existing.public_id,
        pickup_number: existing.pickup_number,
        message: 'Order already created',
        replayed: true,
      });
    }

    const pricing = validateAndPriceOrder(sanitized, db);

    let created;
    try {
      created = db.createOrderWithItems({
        customerId: customer.id,
        idempotencyKey,
        requestHash: pricing.requestHash,
        customerName: sanitized.customerName,
        email: sanitized.email,
        notes: sanitized.notes,
        subtotalCents: pricing.subtotalCents,
        taxCents: pricing.taxCents,
        totalCents: pricing.totalCents,
        items: pricing.items,
        actorSubject: req.customerIdentity.subject,
      });
    } catch (error) {
      // A concurrent request can win the UNIQUE(customer_id, key) race.
      if (String(error.code || '').includes('SQLITE_CONSTRAINT')) {
        const raced = db.getOrderByIdempotency(customer.id, idempotencyKey);
        if (raced && raced.request_hash === requestHash) {
          return res.status(200).json({
            id: raced.public_id,
            public_id: raced.public_id,
            pickup_number: raced.pickup_number,
            message: 'Order already created',
            replayed: true,
          });
        }
        if (raced) {
          return res.status(409).json({
            message: 'This idempotency key was already used with a different order payload',
            code: 'IDEMPOTENCY_KEY_CONFLICT',
          });
        }
      }
      throw error;
    }

    emitOrderChange(req, created.order, 'new-order');
    if (created.order.email) {
      sendOrderConfirmation(created.order).catch(err => {
        console.error('Failed to send confirmation email:', err);
      });
    }

    return res.status(201).json({
      id: created.public_id,
      public_id: created.public_id,
      pickup_number: created.pickup_number,
      message: 'Order created successfully',
      replayed: false,
    });
  } catch (err) {
    if (err instanceof OrderPricingError) {
      return res.status(err.status || 400).json({
        message: err.message,
        code: err.code,
        errors: err.details,
      });
    }
    console.error('Error creating order:', err);
    return res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get kitchen open/closed status (kitchen staff)
router.get('/kitchen-status', requireAuth, (req, res) => {
  try {
    const open = db.getSetting('kitchen_open') !== 'false';
    const message = db.getSetting('kitchen_closed_message') || '';
    res.json({ open, message });
  } catch (err) {
    console.error('Error getting kitchen status:', err);
    res.status(500).json({ message: 'Failed to load kitchen status' });
  }
});

// Toggle kitchen open/closed (kitchen staff)
router.patch('/kitchen-status', requireAuth, (req, res) => {
  try {
    const { open, message } = req.body || {};
    if (typeof open !== 'boolean') {
      return res.status(400).json({ message: '`open` must be a boolean' });
    }
    db.setSetting('kitchen_open', open ? 'true' : 'false');
    if (typeof message === 'string') db.setSetting('kitchen_closed_message', message.slice(0, 200));
    const status = {
      open,
      message: open ? '' : (db.getSetting('kitchen_closed_message') || ''),
    };
    const io = req.app.get('io');
    if (io) io.to('staff').emit('kitchen-status', status);
    return res.json({ message: 'Kitchen status updated', ...status });
  } catch (err) {
    console.error('Error setting kitchen status:', err);
    return res.status(500).json({ message: 'Failed to update kitchen status' });
  }
});

// Active orders are a staff-only HTTP surface.
router.get('/active', requireAuth, (req, res) => {
  try {
    return res.json(db.getActiveOrders());
  } catch (err) {
    console.error('Error getting active orders:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
});

// Customer-owned order view. Staff may use the same endpoint with its JWT;
// customers must present the verified upstream subject used at checkout.
router.get('/:id', optionalAuth, requireCustomerOrStaff, (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;

    const order = db.getOrderByPublicId(publicId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (req.auth?.role !== 'admin') {
      const customer = db.getCustomerBySubject(req.customerIdentity.subject);
      if (!customer || customer.id !== order.customer_id) {
        return res.status(404).json({ message: 'Order not found' });
      }
    }
    return res.json(req.auth?.role === 'admin' ? order : customerOrderView(order));
  } catch (err) {
    console.error('Error getting order:', err);
    return res.status(500).json({ message: 'Failed to load order' });
  }
});

// Staff-only lifecycle transition. The public UUID is resolved to the
// private numeric row id only inside the server.
router.patch('/:id/status', requireAuth, (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;
    const validation = validateOrderStatus(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid status', errors: validation.errors });
    }
    const existing = db.getOrderByPublicId(publicId);
    if (!existing) return res.status(404).json({ message: 'Order not found' });
    const reason = typeof req.body.reason === 'string' ? sanitizeText(req.body.reason, 500) : null;
    let result;
    if (validation.data.status === 'cancelled') {
      result = db.cancelOrder(existing.id, {
        reason,
        source: 'staff',
        actorSubject: actorSubject(req),
      });
    } else {
      result = db.transitionOrderStatus(existing.id, validation.data.status, {
        actorType: 'staff',
        actorSubject: actorSubject(req),
      });
    }
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : 409;
      return res.status(status).json({
        message: result.message,
        code: result.code,
        order: req.auth?.role === 'admin' ? result.order : customerOrderView(result.order),
      });
    }
    const order = result.order;
    emitOrderChange(req, order);
    if (validation.data.status === 'ready') {
      if (order.email) sendOrderReadyNotification(order).catch(err => console.error('Failed to send ready notification email:', err));
      schedulePickupReminderAfterReady(order.id, req.app.get('io'));
    }
    if (validation.data.status === 'cancelled' && order.email) {
      sendOrderCancellation(order).catch(err => console.error('Failed to send cancellation email:', err));
    }
    return res.json({ message: 'Status updated', order });
  } catch (err) {
    console.error('Error updating status:', err);
    return res.status(500).json({ message: 'Failed to update status' });
  }
});

// Customer cancellation requires ownership and remains pending-only.
router.patch('/:id/cancel', requireCustomerIdentity, (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;
    const customer = db.getCustomerBySubject(req.customerIdentity.subject);
    const order = customer ? db.getOrderForCustomer(publicId, customer.id) : null;
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const reason = typeof req.body?.reason === 'string' ? sanitizeText(req.body.reason, 500) : null;
    const result = db.cancelOrder(order.id, {
      reason,
      source: 'customer',
      actorSubject: req.customerIdentity.subject,
    });
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : result.code === 'too_late' || result.code === 'final_state' ? 409 : 400;
      return res.status(status).json({ message: result.message, code: result.code, order: result.order });
    }
    emitOrderChange(req, result.order);
    if (result.order.email) sendOrderCancellation(result.order).catch(err => console.error('Failed to send cancellation email:', err));
    return res.json({ message: 'Order cancelled', order: customerOrderView(result.order) });
  } catch (err) {
    console.error('Error cancelling order:', err);
    return res.status(500).json({ message: 'Failed to cancel order' });
  }
});

export default router;
