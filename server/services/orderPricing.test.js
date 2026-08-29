import test from 'node:test';
import assert from 'node:assert/strict';
import database, {
  createOrderWithItems,
  getActiveOrders,
  getOrCreateCustomer,
  isPaymentFulfillmentEligible,
} from '../db/database.js';
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
    getSetting: key => (key === 'tax_rate' ? '0.0825' : null),
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

test('prices menu and modifiers from database cents, ignoring client money fields', () => {
  const pricing = validateAndPriceOrder(makeOrder({
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

test('rejects unavailable menu items and modifiers not linked to the item', () => {
  assert.throws(
    () => validateAndPriceOrder(makeOrder(), makeDb({ item: { available: 0 } })),
    error => error instanceof OrderPricingError && error.code === 'MENU_ITEM_UNAVAILABLE',
  );

  assert.throws(
    () => validateAndPriceOrder(makeOrder(), makeDb({
      groups: [{ id: 8, name: 'Other', display_name: 'Other', min_selections: 0, max_selections: 2, required: 0 }],
    })),
    error => error instanceof OrderPricingError && error.code === 'MODIFIER_NOT_ALLOWED',
  );
});

test('enforces required modifier cardinality', () => {
  assert.throws(
    () => validateAndPriceOrder(
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

test('active orders exclude provider-unpaid orders but retain legacy cash orders', () => {
  const customer = getOrCreateCustomer('active-orders-payment-test');
  const common = {
    customerId: customer.id,
    customerName: 'Payment Test',
    subtotalCents: 100,
    taxCents: 8,
    totalCents: 108,
    items: [],
    actorSubject: 'active-orders-payment-test',
  };
  const legacyCash = createOrderWithItems({
    ...common,
    idempotencyKey: 'active-orders-cash-001',
    requestHash: 'active-orders-cash-hash',
  });
  const providerUnpaid = createOrderWithItems({
    ...common,
    idempotencyKey: 'active-orders-provider-001',
    requestHash: 'active-orders-provider-hash',
    paymentStatus: 'pending',
    paymentMethod: 'square',
  });
  const paidProvider = createOrderWithItems({
    ...common,
    idempotencyKey: 'active-orders-paid-001',
    requestHash: 'active-orders-paid-hash',
    paymentStatus: 'paid',
    paymentMethod: 'square',
  });

  try {
    const activeIds = new Set(getActiveOrders().map(order => order.id));
    assert.equal(activeIds.has(legacyCash.id), true);
    assert.equal(activeIds.has(providerUnpaid.id), false);
    assert.equal(activeIds.has(paidProvider.id), true);
  } finally {
    database.prepare('DELETE FROM orders WHERE id IN (?, ?, ?)').run(
      legacyCash.id,
      providerUnpaid.id,
      paidProvider.id,
    );
    database.prepare('DELETE FROM customers WHERE id = ?').run(customer.id);
  }
});
