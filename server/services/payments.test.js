import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToCents, buildCheckoutLineItems, createCheckoutSessionForOrder } from './payments.js';

test('dollarsToCents converts dollars to integer cents', () => {
  assert.equal(dollarsToCents(10.5), 1050);
  assert.equal(dollarsToCents(0.07), 7);
  assert.equal(dollarsToCents(12.34), 1234);
  assert.equal(dollarsToCents(0), 0);
  assert.equal(dollarsToCents(0.1 + 0.2), 30); // classic float trap: 0.30000000000000004
  assert.equal(dollarsToCents('10.50'), 1050);  // defensive: stringy numeric input
});

test('buildCheckoutLineItems charges the exact order total as one line', () => {
  const order = { id: 7, pickup_number: 42, total: 10.5 };
  const items = buildCheckoutLineItems(order);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
  assert.equal(items[0].price_data.currency, 'usd');
  assert.equal(items[0].price_data.unit_amount, 1050);
  assert.match(items[0].price_data.product_data.name, /Order #42/);
});

test('createCheckoutSessionForOrder builds a payment-mode session for the order', async () => {
  const calls = [];
  const fakeStripe = {
    checkout: { sessions: { create: async (params) => { calls.push(params); return { id: 'cs_test_123', url: 'https://stripe.test/cs_test_123' }; } } },
  };
  const order = { id: 7, pickup_number: 42, total: 10.5, email: 'a@b.com' };

  const session = await createCheckoutSessionForOrder(order, { stripe: fakeStripe, origin: 'https://shop.test' });

  assert.equal(session.url, 'https://stripe.test/cs_test_123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'payment');
  assert.equal(calls[0].success_url, 'https://shop.test/confirmation/7?paid=1');
  assert.equal(calls[0].cancel_url, 'https://shop.test/checkout');
  assert.equal(calls[0].client_reference_id, '7');
  assert.equal(calls[0].customer_email, 'a@b.com');
  assert.equal(calls[0].metadata.order_id, '7');
  assert.equal(calls[0].metadata.channel, 'online');
  assert.equal(calls[0].payment_intent_data.metadata.order_id, '7');
  assert.equal(calls[0].payment_intent_data.metadata.channel, 'online');
  assert.equal(calls[0].line_items[0].price_data.unit_amount, 1050);
});
