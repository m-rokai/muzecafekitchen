import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOrderCreation } from './schemas.js';

const validOrder = {
  customerName: 'Customer',
  email: 'customer@example.com',
  channel: 'cafe',
  items: [{ menu_item_id: 1, quantity: 1, modifiers: [] }],
};

test('requires a valid email and recognized storefront for every order', () => {
  assert.equal(validateOrderCreation(validOrder).success, true);
  assert.equal(validateOrderCreation({ ...validOrder, email: '' }).success, false);
  assert.equal(validateOrderCreation({ ...validOrder, channel: 'delivery' }).success, false);
});
