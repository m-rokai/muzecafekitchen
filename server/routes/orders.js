import crypto from 'crypto';
import express from 'express';
import * as db from '../db/database.js';
import {
  isStaffRole,
  optionalAuth,
  requireAuth,
  requireCustomerIdentity,
} from '../middleware/auth.js';
import { orderRateLimit } from '../middleware/rateLimit.js';
import { validateOrderCreation, validateOrderStatus } from '../validators/schemas.js';
import { sanitizeOrderData, sanitizeText } from '../utils/sanitize.js';
import {
  sendOrderCancellation,
  sendOrderConfirmation,
  sendOrderReadyNotification,
} from '../services/email.js';
import {
  OrderPricingError,
  hashOrderRequest,
  normalizeOrderRequest,
  validateAndPriceOrder,
} from '../services/orderPricing.js';
import {
  assertProviderConfigured,
  createProviderCheckout,
  PaymentProcessingError,
  PaymentProviderNotConfiguredError,
} from '../services/payments.js';

const router = express.Router();
const PUBLIC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;
const PAYMENT_ATTEMPT_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

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
    payment_reference: paymentReference,
    ...safeOrder
  } = order;
  safeOrder.items = (order.items || []).map((item) => {
    const { id: itemId, order_id: orderId, ...safeItem } = item;
    return safeItem;
  });
  return safeOrder;
}

async function requireCustomerOrStaff(req, res, next) {
  if (isStaffRole(req.auth?.role)) return next();
  return requireCustomerIdentity(req, res, next);
}

// Create an order. Identity, idempotency, product availability, modifier
// cardinality, and all money values are server-authoritative.
router.post('/', orderRateLimit, requireCustomerIdentity, async (req, res) => {
  try {
    if (await db.getSetting('kitchen_open') === 'false') {
      const message = await db.getSetting('kitchen_closed_message')
        || 'Online ordering is temporarily paused. Please try again soon.';
      return res.status(503).json({ message, kitchenClosed: true });
    }

    const validation = validateOrderCreation(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid order data', errors: validation.errors });
    }

    const sanitized = sanitizeOrderData(validation.data);
    if (!sanitized.customerName || !sanitized.email || !sanitized.channel || sanitized.items.length === 0) {
      return res.status(400).json({ message: 'Customer name, email, storefront, and items are required' });
    }
    const provider = assertProviderConfigured(sanitized.channel);

    const idempotencyKey = req.get('Idempotency-Key');
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey || '')) {
      return res.status(400).json({
        message: 'A valid Idempotency-Key header is required',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }

    const customer = await db.getOrCreateCustomer(req.customerIdentity.subject);
    const paymentAttemptKey = req.get('Payment-Attempt-Key');
    if (provider === 'square' && !PAYMENT_ATTEMPT_KEY_PATTERN.test(paymentAttemptKey || '')) {
      return res.status(400).json({
        message: 'A valid Payment-Attempt-Key header is required for Square checkout',
        code: 'PAYMENT_ATTEMPT_KEY_REQUIRED',
      });
    }
    // Resolve idempotency against the canonical request body before touching
    // the live catalog. Exact retries remain replayable after a menu change;
    // a changed body still conflicts without leaking catalog details.
    const requestHash = hashOrderRequest(normalizeOrderRequest(sanitized));
    const existing = await db.getOrderByIdempotency(customer.id, idempotencyKey);
    if (existing && existing.request_hash !== requestHash) {
      return res.status(409).json({
        message: 'This idempotency key was already used with a different order payload',
        code: 'IDEMPOTENCY_KEY_CONFLICT',
      });
    }
    if (existing && ['paid', 'authorized'].includes(existing.payment_status)) {
      return res.status(200).json({
        id: existing.public_id,
        public_id: existing.public_id,
        pickup_number: existing.pickup_number,
        payment_status: existing.payment_status,
        message: 'Order already paid',
        replayed: true,
      });
    }
    if (existing) {
      // Continue below with the same provider idempotency key so an interrupted
      // checkout can be resumed without creating or charging another order.
    }

    const pricing = existing ? null : await validateAndPriceOrder(sanitized, db);

    let created;
    if (existing) {
      created = {
        id: existing.id,
        public_id: existing.public_id,
        pickup_number: existing.pickup_number,
        order: existing,
      };
    } else try {
      created = await db.createOrderWithItems({
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
        channel: sanitized.channel,
        partnerId: pricing.partnerId,
        preorderDeadline: pricing.partnerOrderDeadline,
        preorderDeliveryDate: pricing.partnerDeliveryDate,
        paymentStatus: 'pending',
        paymentMethod: provider,
        paymentProvider: provider,
      });
    } catch (error) {
      // A concurrent request can win the UNIQUE(customer_id, key) race.
      if (error.code === '23505') {
        const raced = await db.getOrderByIdempotency(customer.id, idempotencyKey);
        if (raced && raced.request_hash === requestHash) {
          created = {
            id: raced.id,
            public_id: raced.public_id,
            pickup_number: raced.pickup_number,
            order: raced,
          };
        }
        if (raced && raced.request_hash !== requestHash) {
          return res.status(409).json({
            message: 'This idempotency key was already used with a different order payload',
            code: 'IDEMPOTENCY_KEY_CONFLICT',
          });
        }
      }
      if (!created) throw error;
    }

    const paymentIdempotencyKey = crypto.createHash('sha256')
      .update(`${provider}:${customer.id}:${idempotencyKey}:${provider === 'square' ? paymentAttemptKey : 'checkout'}`)
      .digest('hex');
    const attempt = await db.createPaymentAttempt({
      orderId: created.id,
      provider,
      idempotencyKey: paymentIdempotencyKey,
      amountCents: created.order.total_cents,
      metadata: { order_public_id: created.public_id, channel: sanitized.channel },
    });
    let checkout;
    try {
      checkout = await createProviderCheckout({
        order: created.order,
        sourceToken: sanitized.paymentSourceToken,
        idempotencyKey: paymentIdempotencyKey,
      });
      await db.updatePaymentAttempt(attempt.id, {
        status: checkout.status,
        externalReference: checkout.externalReference,
        metadata: checkout.metadata,
      });
      created.order = await db.setOrderPaymentState(created.id, {
        provider,
        status: checkout.status,
        externalReference: checkout.externalReference,
        paymentId: attempt.id,
        metadata: checkout.metadata,
      });
      // Square normally confirms the charge in this request. Send the receipt
      // before returning so a serverless function cannot terminate the task;
      // the later webhook sees no new paid transition and will not duplicate it.
      if (created.order?.payment_transitioned_to_paid) {
        await sendOrderConfirmation(created.order);
      }
    } catch (error) {
      await db.updatePaymentAttempt(attempt.id, {
        status: error instanceof PaymentProviderNotConfiguredError || error.status >= 500
          ? 'pending'
          : 'failed',
        metadata: { error_code: error.code || 'PAYMENT_ERROR' },
      });
      throw error;
    }

    return res.status(201).json({
      id: created.public_id,
      public_id: created.public_id,
      pickup_number: created.pickup_number,
      payment_status: created.order.payment_status,
      payment_provider: provider,
      checkout_url: checkout.checkoutUrl,
      message: checkout.checkoutUrl ? 'Continue to secure payment' : 'Payment processed successfully',
      replayed: Boolean(existing),
    });
  } catch (err) {
    if (err instanceof OrderPricingError) {
      return res.status(err.status || 400).json({
        message: err.message,
        code: err.code,
        errors: err.details,
      });
    }
    if (err instanceof PaymentProviderNotConfiguredError || err instanceof PaymentProcessingError) {
      return res.status(err.status || 503).json({
        message: err.message,
        code: err.code,
        provider: err.provider,
      });
    }
    console.error('Error creating order:', err);
    return res.status(500).json({ message: 'Failed to create order' });
  }
});

// Get kitchen open/closed status (kitchen staff)
router.get('/kitchen-status', requireAuth, async (req, res) => {
  try {
    const open = await db.getSetting('kitchen_open') !== 'false';
    const message = await db.getSetting('kitchen_closed_message') || '';
    res.json({ open, message });
  } catch (err) {
    console.error('Error getting kitchen status:', err);
    res.status(500).json({ message: 'Failed to load kitchen status' });
  }
});

// Toggle kitchen open/closed (kitchen staff)
router.patch('/kitchen-status', requireAuth, async (req, res) => {
  try {
    const { open, message } = req.body || {};
    if (typeof open !== 'boolean') {
      return res.status(400).json({ message: '`open` must be a boolean' });
    }
    await db.setSetting('kitchen_open', open ? 'true' : 'false');
    if (typeof message === 'string') await db.setSetting('kitchen_closed_message', message.slice(0, 200));
    const status = {
      open,
      message: open ? '' : (await db.getSetting('kitchen_closed_message') || ''),
    };
    return res.json({ message: 'Kitchen status updated', ...status });
  } catch (err) {
    console.error('Error setting kitchen status:', err);
    return res.status(500).json({ message: 'Failed to update kitchen status' });
  }
});

// Active orders are a staff-only HTTP surface.
router.get('/active', requireAuth, async (req, res) => {
  try {
    const channel = req.query.channel || 'cafe';
    if (!['cafe', 'partner_meal'].includes(channel)) {
      return res.status(400).json({ message: 'Invalid storefront channel' });
    }
    return res.json(await db.getActiveOrders(channel));
  } catch (err) {
    console.error('Error getting active orders:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
});

// Customer-owned order view. Staff may use the same endpoint with its JWT;
// customers must present the verified upstream subject used at checkout.
router.get('/:id', optionalAuth, requireCustomerOrStaff, async (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;

    const order = await db.getOrderByPublicId(publicId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!isStaffRole(req.auth?.role)) {
      const customer = await db.getCustomerBySubject(req.customerIdentity.subject);
      if (!customer || customer.id !== order.customer_id) {
        return res.status(404).json({ message: 'Order not found' });
      }
    }
    return res.json(isStaffRole(req.auth?.role) ? order : customerOrderView(order));
  } catch (err) {
    console.error('Error getting order:', err);
    return res.status(500).json({ message: 'Failed to load order' });
  }
});

// Staff-only lifecycle transition. The public UUID is resolved to the
// private numeric row id only inside the server.
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;
    const validation = validateOrderStatus(req.body);
    if (!validation.success) {
      return res.status(400).json({ message: 'Invalid status', errors: validation.errors });
    }
    const existing = await db.getOrderByPublicId(publicId);
    if (!existing) return res.status(404).json({ message: 'Order not found' });
    if (validation.data.status === 'cancelled'
      && ['paid', 'authorized'].includes(existing.payment_status)
      && existing.payment_method !== 'cash') {
      return res.status(409).json({
        message: 'Refund handling must be completed before cancelling this paid order',
        code: 'REFUND_REQUIRED',
      });
    }
    const reason = typeof req.body.reason === 'string' ? sanitizeText(req.body.reason, 500) : null;
    let result;
    if (validation.data.status === 'cancelled') {
      result = await db.cancelOrder(existing.id, {
        reason,
        source: 'staff',
        actorSubject: actorSubject(req),
      });
    } else {
      result = await db.transitionOrderStatus(existing.id, validation.data.status, {
        actorType: 'staff',
        actorSubject: actorSubject(req),
      });
    }
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : 409;
      return res.status(status).json({
        message: result.message,
        code: result.code,
        order: result.order,
      });
    }
    const order = result.order;
    if (validation.data.status === 'ready') {
      if (order.email) sendOrderReadyNotification(order).catch(err => console.error('Failed to send ready notification email:', err));
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
router.patch('/:id/cancel', requireCustomerIdentity, async (req, res) => {
  try {
    const publicId = publicIdFromRequest(req, res);
    if (!publicId) return undefined;
    const customer = await db.getCustomerBySubject(req.customerIdentity.subject);
    const order = customer ? await db.getOrderForCustomer(publicId, customer.id) : null;
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['paid', 'authorized'].includes(order.payment_status) && order.payment_method !== 'cash') {
      return res.status(409).json({
        message: 'Please contact Muze staff to cancel and refund this paid order',
        code: 'REFUND_REQUIRED',
      });
    }
    const reason = typeof req.body?.reason === 'string' ? sanitizeText(req.body.reason, 500) : null;
    const result = await db.cancelOrder(order.id, {
      reason,
      source: 'customer',
      actorSubject: req.customerIdentity.subject,
    });
    if (!result.ok) {
      const status = result.code === 'not_found' ? 404 : result.code === 'too_late' || result.code === 'final_state' ? 409 : 400;
      return res.status(status).json({ message: result.message, code: result.code, order: result.order });
    }
    if (result.order.email) sendOrderCancellation(result.order).catch(err => console.error('Failed to send cancellation email:', err));
    return res.json({ message: 'Order cancelled', order: customerOrderView(result.order) });
  } catch (err) {
    console.error('Error cancelling order:', err);
    return res.status(500).json({ message: 'Failed to cancel order' });
  }
});

export default router;
