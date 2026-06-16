import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToCents, buildCheckoutLineItems } from './payments.js';

test('dollarsToCents converts dollars to integer cents', () => {
  assert.equal(dollarsToCents(10.5), 1050);
  assert.equal(dollarsToCents(0.07), 7);
  assert.equal(dollarsToCents(12.34), 1234);
  assert.equal(dollarsToCents(0), 0);
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
