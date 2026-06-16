import express from 'express';
import * as db from '../db/database.js';
import { createCheckoutSessionForOrder } from '../services/payments.js';

const router = express.Router();

// Create a Stripe Checkout Session for an existing unpaid order.
router.post('/checkout-session', async (req, res) => {
  try {
    const orderId = parseInt(req.body?.orderId, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }

    const order = db.getOrder(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.status(409).json({ message: 'Order is already paid' });
    }

    const origin = req.headers.origin || process.env.PUBLIC_URL || 'http://localhost:5173';
    const session = await createCheckoutSessionForOrder(order, { origin });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ message: 'Failed to start checkout' });
  }
});

export default router;
