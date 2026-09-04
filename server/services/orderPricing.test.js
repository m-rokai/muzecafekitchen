import test from 'node:test';
import assert from 'node:assert/strict';
import { isPaymentFulfillmentEligible } from '../db/database.js';
import { OrderPricingError, validateAndPriceOrder } from './orderPricing.js';

function makeDb({ item = {}, groups = [], options = [] } = {}) {
  const menuItem = {
    id: 1,
    name: 'Latte',
    price: 5.5,
    price_cents: 550,
    available: 1,
    ...item,
  };
  const modifierGroups = groups.length > 0
    ? groups
    : [{ id: 7, name: 'Milk', display_name: 'Milk', min_selections: 0, max_selections: 2, required: 0 }];
  const modifierOptions = options.length > 0
    ? options
    : [{ id: 10, group_id: 7, name: 'Oat Milk', available: 1, price_adjustment_cents: 75 }];

  return {
    dollarsToCents: value => Math.round(Number(value) * 100),
    getMenuItem: id => (id === menuItem.id ? menuItem : null),
    getModifiersForItem: id => (id === menuItem.id ? modifierGroups : []),
    getModifierOption: id => modifierOptions.find(option => option.id === id) || null,
    getSetting: key => ({ tax_rate: '0.0825', partner_tax_rate: '0.08375' })[key] ?? null,
  };
}

function makeOrder(overrides = {}) {
  return {
    customerName: 'Ada Lovelace',
    email: 'ada@example.com',
    notes: null,
    items: [{
      menu_item_id: 1,
      quantity: 2,
      special_instructions: null,
      modifiers: [{ modifier_option_id: 10 }],
    }],
    ...overrides,
  };
}

test('prices menu and modifiers from database cents, ignoring client money fields', async () => {
  const pricing = await validateAndPriceOrder(makeOrder({
    subtotal: 0,
    total: 0,
    items: [{
      ...makeOrder().items[0],
      unit_price: 0,
      modifiers: [{ modifier_option_id: 10, price_adjustment: 0 }],
    }],
  }), makeDb());

  assert.equal(pricing.subtotalCents, 1250);
  assert.equal(pricing.taxCents, 103);
  assert.equal(pricing.totalCents, 1353);
  assert.equal(pricing.items[0].unitPriceCents, 550);
  assert.equal(pricing.items[0].modifiers[0].priceAdjustmentCents, 75);
  assert.equal(pricing.items[0].totalPriceCents, 1250);
  assert.equal(pricing.normalized.items[0].menu_item_id, 1);
  assert.equal(pricing.normalized.items[0].unit_price, undefined);
});

test('rejects unavailable menu items and modifiers not linked to the item', async () => {
  await assert.rejects(
    validateAndPriceOrder(makeOrder(), makeDb({ item: { available: 0 } })),
    error => error instanceof OrderPricingError && error.code === 'MENU_ITEM_UNAVAILABLE',
  );

  await assert.rejects(
    validateAndPriceOrder(makeOrder(), makeDb({
      groups: [{ id: 8, name: 'Other', display_name: 'Other', min_selections: 0, max_selections: 2, required: 0 }],
    })),
    error => error instanceof OrderPricingError && error.code === 'MODIFIER_NOT_ALLOWED',
  );
});

test('enforces required modifier cardinality', async () => {
  await assert.rejects(
    validateAndPriceOrder(
      makeOrder({ items: [{ ...makeOrder().items[0], modifiers: [] }] }),
      makeDb({ groups: [{ id: 7, name: 'Milk', display_name: 'Milk', min_selections: 1, max_selections: 1, required: 1 }] }),
    ),
    error => error instanceof OrderPricingError && error.code === 'MODIFIER_CARDINALITY',
  );
});

test('keeps provider-unpaid states out of fulfillment while allowing explicit legacy cash', () => {
  assert.equal(isPaymentFulfillmentEligible({ payment_status: 'awaiting' }), false);
  assert.equal(isPaymentFulfillmentEligible({ payment_status: 'unpaid' }), false);
  assert.equal(isPaymentFulfillmentEligible({ payment_status: 'unpaid', payment_method: 'cash' }), true);
  assert.equal(isPaymentFulfillmentEligible({ payment_status: 'authorized', payment_method: 'square' }), true);
});

test('backs the Clark County tax out of the flat partner-meal price', async () => {
  const pricing = await validateAndPriceOrder(makeOrder({
    channel: 'partner_meal',
    items: [{
      menu_item_id: 1,
      quantity: 1,
      special_instructions: null,
      modifiers: [],
    }],
  }), makeDb({
    item: {
      name: 'Za’atar Chicken',
      channel: 'partner_meal',
      partner_id: 'partner-1',
      price_cents: 2059,
      menu_week: '2026-09-14',
    },
    groups: [],
    options: [],
  }), { now: new Date('2026-09-02T20:00:00Z') });

  assert.equal(pricing.subtotalCents, 1900);
  assert.equal(pricing.taxCents, 159);
  assert.equal(pricing.totalCents, 2059);
  assert.equal(pricing.taxIncluded, true);
  assert.equal(pricing.partnerId, 'partner-1');
  assert.equal(pricing.partnerDeliveryDate, '2026-09-14');
  assert.equal(pricing.partnerOrderDeadline, '2026-09-09T19:00:00.000Z');
});

test('rejects partner pre-orders at and after Wednesday noon Pacific', async () => {
  const order = makeOrder({
    channel: 'partner_meal',
    items: [{ menu_item_id: 1, quantity: 1, special_instructions: null, modifiers: [] }],
  });
  const database = makeDb({
    item: {
      name: 'Za’atar Chicken', channel: 'partner_meal', partner_id: 'partner-1',
      price_cents: 2059, menu_week: '2026-09-14',
    },
    groups: [],
    options: [],
  });

  await assert.rejects(
    validateAndPriceOrder(order, database, { now: new Date('2026-09-09T19:00:00.000Z') }),
    error => error instanceof OrderPricingError
      && error.code === 'PARTNER_PREORDER_CLOSED'
      && error.status === 409,
  );
});
