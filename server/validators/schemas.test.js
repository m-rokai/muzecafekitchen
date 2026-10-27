import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMenuItem, validateMenuItemUpdate, validateOrderCreation } from './schemas.js';

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

test('new menu items retain their uploaded image and modifier selections', () => {
  const result = validateMenuItem({
    name: 'Latte', price: 5.5,
    image_url: 'https://example.supabase.co/storage/v1/object/public/menu-images/menu-test.webp',
    modifier_group_ids: [1, 2, 1],
  });
  assert.equal(result.success, true);
  assert.match(result.data.image_url, /menu-test.webp$/);
  assert.deepEqual(result.data.modifier_group_ids, [1, 2]);
});

test('partial menu edits preserve omitted values and support removing a photo or all groups', () => {
  assert.deepEqual(validateMenuItemUpdate({ image_url: null }), {
    success: true, data: { image_url: null },
  });
  assert.deepEqual(validateMenuItemUpdate({ modifier_group_ids: [] }), {
    success: true, data: { modifier_group_ids: [] },
  });
  assert.equal(validateMenuItemUpdate({ modifier_group_ids: [null] }).success, false);
  assert.equal(validateMenuItemUpdate({ modifier_group_ids: '1' }).success, false);
  assert.equal(validateMenuItemUpdate({ price: -1 }).success, false);
});
