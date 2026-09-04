import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStripeCheckoutParams, providerForChannel, squareStatus, stripeStatus } from './payments.js';

test('routes each storefront to its mandated payment provider', () => {
  assert.equal(providerForChannel('cafe'), 'square');
  assert.equal(providerForChannel('partner_meal'), 'stripe');
});

test('puts the weekly pre-order schedule in Stripe checkout and receipt data', () => {
  const params = buildStripeCheckoutParams({
    public_id: '3e9605ef-6455-4444-8888-26f8da5b15e4',
    channel: 'partner_meal',
    email: 'ada@example.com',
    preorder_deadline: '2026-09-09T19:00:00.000Z',
    preorder_delivery_date: '2026-09-14',
    tax_cents: 159,
    items: [{ item_name: 'Za’atar Chicken', quantity: 1, total_price_cents: 2059 }],
  }, 'https://example.com', Date.parse('2026-09-02T20:00:00Z'));

  assert.match(params.custom_text.submit.message, /Weekly meal pre-order/);
  assert.match(params.custom_text.submit.message, /Wednesday, September 9, 2026 at 12:00 PM Pacific/);
  assert.match(params.custom_text.submit.message, /Monday, September 14, 2026/);
  assert.equal(params.payment_intent_data.receipt_email, 'ada@example.com');
  assert.equal(params.metadata.preorder_delivery_date, '2026-09-14');
  assert.match(params.line_items[0].price_data.product_data.description, /delivered to Muze for pickup/);
  assert.match(params.line_items[0].price_data.product_data.description, /Prices include Nevada sales tax/);
  assert.equal(params.line_items.length, 1);
  assert.equal(params.line_items[0].price_data.unit_amount, 2059);
});

test('normalizes provider payment states conservatively', () => {
  assert.equal(squareStatus('COMPLETED'), 'paid');
  assert.equal(squareStatus('APPROVED'), 'authorized');
  assert.equal(squareStatus('FAILED'), 'failed');
  assert.equal(stripeStatus({ payment_status: 'paid' }), 'paid');
  assert.equal(stripeStatus({ payment_status: 'unpaid', status: 'open' }), 'pending');
  assert.equal(stripeStatus({ payment_status: 'unpaid', status: 'expired' }), 'failed');
});
