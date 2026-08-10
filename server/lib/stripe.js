import Stripe from 'stripe';

// Lazy singleton so importing payment code in tests (or before env is set)
// never requires STRIPE_SECRET_KEY. The client is built on first real use.
let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  return _stripe;
}
