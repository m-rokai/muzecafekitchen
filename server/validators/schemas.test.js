import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOrderCreation } from './schemas.js';

const validOrder = {
  customerName: 'Customer',
  email: 'customer@example.com',
  channel: 'cafe',
  items: [{ menu_item_id: 1, quantity: 1, modifiers: [] }],
};

test('requires a valid email and the café storefront for every new order', () => {
  assert.equal(validateOrderCreation(validOrder).success, true);
  assert.equal(validateOrderCreation({ ...validOrder, email: '' }).success, false);
  assert.equal(validateOrderCreation({ ...validOrder, channel: 'delivery' }).success, false);
  assert.equal(validateOrderCreation({ ...validOrder, channel: 'partner_meal' }).success, false);
});

test('accepts an optional ISO pickup time and rejects malformed pickup values', () => {
  assert.equal(validateOrderCreation({
    ...validOrder,
    pickupAt: '2026-09-14T18:30:00.000Z',
  }).success, true);
  assert.equal(validateOrderCreation({ ...validOrder, pickupAt: null }).success, true);
  assert.equal(validateOrderCreation({ ...validOrder, pickupAt: 'tomorrow at noon' }).success, false);
});
