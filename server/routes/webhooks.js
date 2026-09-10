import crypto from 'crypto';
import express from 'express';
import * as db from '../db/database.js';
import { sendOrderConfirmation } from '../services/email.js';
import {
  squareStatus,
  verifySquareWebhook,
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
