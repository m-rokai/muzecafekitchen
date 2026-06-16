import { getStripe } from '../lib/stripe.js';

// Convert a dollar amount (REAL in the DB) to integer cents for Stripe.
export function dollarsToCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

// One line item for the exact order total (tax included). Charging a single
// line equal to order.total guarantees the captured amount matches our trusted
// server-side total with no rounding/tax drift. Itemization is shown in our UI.
export function buildCheckoutLineItems(order) {
  return [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(order.total),
        product_data: {
          name: `Muze Café — Order #${order.pickup_number}`,
        },
      },
    },
  ];
}

// Create a Stripe-hosted Checkout Session for an order. `stripe` is injectable
// for tests; `origin` is the absolute base URL for success/cancel redirects.
export async function createCheckoutSessionForOrder(order, { stripe = getStripe(), origin } = {}) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: buildCheckoutLineItems(order),
    success_url: `${origin}/confirmation/${order.id}?paid=1`,
    cancel_url: `${origin}/checkout`,
    client_reference_id: String(order.id),
    customer_email: order.email || undefined,
    metadata: { order_id: String(order.id), channel: 'online' },
    payment_intent_data: { metadata: { order_id: String(order.id), channel: 'online' } },
  });
}
