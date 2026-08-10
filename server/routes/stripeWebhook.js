import express from 'express';
import * as db from '../db/database.js';
import { getStripe } from '../lib/stripe.js';
import { sendOrderConfirmation } from '../services/email.js';

const router = express.Router();

// Stripe webhook. Mounted with express.raw so req.body is the raw Buffer
// required for signature verification. This is the SOURCE OF TRUTH for "paid".
router.post('/', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Missing secret is a server misconfig, not a bad request. Return 500 so
  // Stripe RETRIES (it gives up on 4xx) once the secret is configured —
  // otherwise every real event would be silently and permanently dropped.
  if (!secret) {
    console.error('FATAL: STRIPE_WEBHOOK_SECRET is not set — cannot verify webhooks');
    return res.status(500).send('Server misconfiguration');
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = parseInt(session.metadata?.order_id || session.client_reference_id, 10);
      if (!Number.isInteger(orderId)) {
        // Non-retryable: the session's metadata won't change on retry. Log loudly
        // so a Checkout-creation misconfig (missing order_id) is visible.
        console.error('Webhook checkout.session.completed has no valid order_id; session:', session.id);
      } else {
        const result = db.markOrderPaid(orderId, {
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          amountCents: session.amount_total ?? null,
        });

        if (result.notFound) {
          console.error('Webhook: no order found for id', orderId, '(session', session.id + ')');
        }

        // Finalize only on the first transition to paid (idempotent).
        if (result.order && !result.alreadyPaid) {
          const io = req.app.get('io');
          if (io) io.emit('new-order', result.order);
          if (result.order.email) {
            sendOrderConfirmation(result.order).catch(e => console.error('Confirmation email failed:', e));
          }
        }
      }
    }
  } catch (err) {
    // markOrderPaid failures are often TRANSIENT (SQLite lock, I/O, /data not
    // mounted yet). markOrderPaid is idempotent, so returning 500 to trigger a
    // Stripe retry is safe and prevents silently losing a paid order.
    console.error('Error handling webhook event:', err);
    return res.status(500).send('Internal error');
  }

  return res.json({ received: true });
});

export default router;
