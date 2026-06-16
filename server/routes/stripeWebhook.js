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
      if (Number.isInteger(orderId)) {
        const result = db.markOrderPaid(orderId, {
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          amountCents: session.amount_total ?? null,
        });

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
    console.error('Error handling webhook event:', err);
    // Still return 200 so Stripe doesn't retry a non-recoverable handler error.
  }

  return res.json({ received: true });
});

export default router;
