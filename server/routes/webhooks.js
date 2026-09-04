import crypto from 'crypto';
import express from 'express';
import * as db from '../db/database.js';
import { sendOrderConfirmation } from '../services/email.js';
import {
  squareStatus,
  stripeStatus,
  verifySquareWebhook,
  verifyStripeWebhook,
} from '../services/payments.js';

const router = express.Router();

function payloadHash(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

async function claim(provider, eventId, eventType, rawBody) {
  return db.claimPaymentWebhookEvent({
    provider,
    providerEventId: eventId,
    eventType,
    payloadSha256: payloadHash(rawBody),
  });
}

async function finishPaidOrder(order) {
  if (!order?.payment_transitioned_to_paid) return;
  if (order.channel === 'partner_meal') await db.enqueuePartnerHandoff(order);
  await sendOrderConfirmation(order);
}

router.post('/stripe', express.raw({ type: 'application/json', limit: '512kb' }), async (req, res) => {
  let event;
  try {
    event = verifyStripeWebhook(req.body, req.get('stripe-signature'));
  } catch (error) {
    console.warn('Rejected Stripe webhook:', error.message);
    return res.status(400).json({ message: 'Invalid Stripe webhook signature' });
  }

  const claimed = await claim('stripe', event.id, event.type, req.body);
  if (!claimed.claimed) return res.json({ received: true, duplicate: true });

  try {
    if ([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ].includes(event.type)) {
      const session = event.data.object;
      const publicId = session.metadata?.order_public_id || session.client_reference_id;
      const current = publicId ? await db.getOrderByPublicId(publicId) : null;
      if (!current) throw new Error('Stripe event does not reference a known order');
      const status = event.type === 'checkout.session.async_payment_failed'
        || event.type === 'checkout.session.expired'
        ? 'failed'
        : stripeStatus(session);
      const updated = await db.setOrderPaymentState(current.id, {
        provider: 'stripe',
        status,
        externalReference: session.id,
        providerEventId: event.id,
        metadata: { stripe_payment_intent: session.payment_intent || null },
      });
      await finishPaidOrder(updated);
    }
    await db.completePaymentWebhookEvent(claimed.event.id);
    return res.json({ received: true });
  } catch (error) {
    await db.completePaymentWebhookEvent(claimed.event.id, error.message);
    console.error('Stripe webhook processing failed:', error);
    return res.status(500).json({ message: 'Stripe webhook processing failed' });
  }
});

router.post('/square', express.raw({ type: 'application/json', limit: '512kb' }), async (req, res) => {
  let payload;
  try {
    if (!await verifySquareWebhook(req.body, req.get('x-square-hmacsha256-signature'))) {
      return res.status(403).json({ message: 'Invalid Square webhook signature' });
    }
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (error) {
    console.warn('Rejected Square webhook:', error.message);
    return res.status(400).json({ message: 'Invalid Square webhook' });
  }

  const eventId = payload.event_id;
  const eventType = payload.type || 'unknown';
  if (!eventId) return res.status(400).json({ message: 'Square event ID is required' });
  const claimed = await claim('square', eventId, eventType, req.body);
  if (!claimed.claimed) return res.json({ received: true, duplicate: true });

  try {
    if (['payment.created', 'payment.updated'].includes(eventType)) {
      const payment = payload.data?.object?.payment;
      const current = payment?.reference_id
        ? await db.getOrderByPublicId(payment.reference_id)
        : await db.getOrderByPaymentReference('square', payment?.id);
      if (!current) throw new Error('Square event does not reference a known order');
      const updated = await db.setOrderPaymentState(current.id, {
        provider: 'square',
        status: squareStatus(payment.status),
        externalReference: payment.id,
        providerEventId: eventId,
        metadata: { square_status: payment.status || null },
      });
      await finishPaidOrder(updated);
    }
    await db.completePaymentWebhookEvent(claimed.event.id);
    return res.json({ received: true });
  } catch (error) {
    await db.completePaymentWebhookEvent(claimed.event.id, error.message);
    console.error('Square webhook processing failed:', error);
    return res.status(500).json({ message: 'Square webhook processing failed' });
  }
});

export default router;
