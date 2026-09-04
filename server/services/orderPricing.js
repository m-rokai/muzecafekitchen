import crypto from 'crypto';
import * as defaultDb from '../db/database.js';
import { partnerScheduleForDelivery, validDateOnly } from '../lib/partnerSchedule.js';

export class OrderPricingError extends Error {
  constructor(message, code = 'ORDER_VALIDATION_FAILED', details = []) {
    super(message);
    this.name = 'OrderPricingError';
    this.code = code;
    this.details = details;
    this.status = 400;
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashOrderRequest(request) {
  return crypto.createHash('sha256')
    .update(stableStringify(request))
    .digest('hex');
}

function parseTaxRate(value) {
  const raw = String(value ?? '0.0825').trim();
  const match = raw.match(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/);
  if (!match) return 0.0825;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.0825;
}

function centsFor(value, db) {
  if (Number.isInteger(value)) return value;
  return db.dollarsToCents(value);
}

export function normalizeOrderRequest(order) {
  return {
    customerName: order.customerName,
    email: order.email,
    channel: order.channel,
    notes: order.notes || null,
    items: order.items.map(item => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      special_instructions: item.special_instructions || null,
      modifiers: item.modifiers.map(modifier => ({
        modifier_option_id: modifier.modifier_option_id,
      })),
    })),
  };
}

/**
 * Resolve menu and modifier IDs and calculate every amount from the current
 * database menu. Client-provided names, prices, subtotals, and totals are
 * intentionally ignored.
 */
export async function validateAndPriceOrder(order, db = defaultDb, { now = new Date() } = {}) {
  const normalized = normalizeOrderRequest(order);
  const verifiedItems = [];
  const partnerIds = new Set();
  const partnerDeliveryDates = new Set();
  let listedPriceTotalCents = 0;

  for (let itemIndex = 0; itemIndex < order.items.length; itemIndex += 1) {
    const item = order.items[itemIndex];
    const menuItem = await db.getMenuItem(item.menu_item_id);
    if (!menuItem) {
      throw new OrderPricingError(
        `Menu item ${item.menu_item_id} was not found`,
        'MENU_ITEM_NOT_FOUND',
        [{ path: `items.${itemIndex}.menu_item_id`, message: 'Unknown menu item' }],
      );
    }
    if (Number(menuItem.available) !== 1) {
      throw new OrderPricingError(
        `${menuItem.name} is not currently available`,
        'MENU_ITEM_UNAVAILABLE',
        [{ path: `items.${itemIndex}.menu_item_id`, message: 'Menu item is unavailable' }],
      );
    }
    if (menuItem.channel !== order.channel) {
      throw new OrderPricingError(
        `${menuItem.name} is not available in this storefront`,
        'STOREFRONT_ITEM_MISMATCH',
        [{ path: `items.${itemIndex}.menu_item_id`, message: 'Item belongs to another storefront' }],
      );
    }
    if (menuItem.partner_id) partnerIds.add(menuItem.partner_id);
    if (order.channel === 'partner_meal') {
      const deliveryDate = validDateOnly(String(menuItem.menu_week || '').slice(0, 10));
      if (!deliveryDate) {
        throw new OrderPricingError(
          `${menuItem.name} does not have a valid delivery date`,
          'PARTNER_SCHEDULE_INVALID',
          [{ path: `items.${itemIndex}.menu_item_id`, message: 'Meal schedule is unavailable' }],
        );
      }
      partnerDeliveryDates.add(deliveryDate);
    }

    const linkedGroups = await db.getModifiersForItem(menuItem.id);
    const groupById = new Map(linkedGroups.map(group => [group.id, group]));
    const seenModifierIds = new Set();
    const selectionsByGroup = new Map();
    const verifiedModifiers = [];

    for (let modifierIndex = 0; modifierIndex < item.modifiers.length; modifierIndex += 1) {
      const requested = item.modifiers[modifierIndex];
      const option = await db.getModifierOption(requested.modifier_option_id);
      const path = `items.${itemIndex}.modifiers.${modifierIndex}.modifier_option_id`;
      if (!option) {
        throw new OrderPricingError(
          `Modifier option ${requested.modifier_option_id} was not found`,
          'MODIFIER_NOT_FOUND',
          [{ path, message: 'Unknown modifier option' }],
        );
      }
      if (Number(option.available) !== 1) {
        throw new OrderPricingError(
          `${option.name} is not currently available`,
          'MODIFIER_UNAVAILABLE',
          [{ path, message: 'Modifier option is unavailable' }],
        );
      }
      if (seenModifierIds.has(option.id)) {
        throw new OrderPricingError(
          'A modifier option can only be selected once per item',
          'MODIFIER_DUPLICATE',
          [{ path, message: 'Duplicate modifier option' }],
        );
      }
      seenModifierIds.add(option.id);

      const group = groupById.get(option.group_id);
      if (!group) {
        throw new OrderPricingError(
          `${option.name} is not allowed for ${menuItem.name}`,
          'MODIFIER_NOT_ALLOWED',
          [{ path, message: 'Modifier is not linked to this menu item' }],
        );
      }

      const groupSelections = selectionsByGroup.get(group.id) || [];
      groupSelections.push(option);
      selectionsByGroup.set(group.id, groupSelections);
      verifiedModifiers.push({
        modifierOptionId: option.id,
        name: option.name,
        priceAdjustmentCents: centsFor(option.price_adjustment_cents, db),
      });
    }

    for (const group of linkedGroups) {
      const count = (selectionsByGroup.get(group.id) || []).length;
      const min = Math.max(Number(group.min_selections) || 0, Number(group.required) ? 1 : 0);
      const max = Number(group.max_selections);
      if (count < min) {
        throw new OrderPricingError(
          `${group.display_name || group.name} requires at least ${min} selection${min === 1 ? '' : 's'}`,
          'MODIFIER_CARDINALITY',
          [{ path: `items.${itemIndex}.modifiers`, message: 'Too few modifiers selected' }],
        );
      }
      if (Number.isFinite(max) && count > max) {
        throw new OrderPricingError(
          `${group.display_name || group.name} allows at most ${max} selections`,
          'MODIFIER_CARDINALITY',
          [{ path: `items.${itemIndex}.modifiers`, message: 'Too many modifiers selected' }],
        );
      }
    }

    const unitPriceCents = centsFor(menuItem.price_cents, db);
    const modifierTotalCents = verifiedModifiers.reduce(
      (sum, modifier) => sum + modifier.priceAdjustmentCents,
      0,
    );
    const unitWithModifiersCents = unitPriceCents + modifierTotalCents;
    if (unitWithModifiersCents < 0) {
      throw new OrderPricingError(
        'The selected modifiers produce an invalid price',
        'INVALID_PRICE',
        [{ path: `items.${itemIndex}.modifiers`, message: 'Price cannot be negative' }],
      );
    }
    const totalPriceCents = unitWithModifiersCents * item.quantity;
    listedPriceTotalCents += totalPriceCents;
    verifiedItems.push({
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      quantity: item.quantity,
      unitPriceCents: unitPriceCents,
      totalPriceCents,
      specialInstructions: item.special_instructions || null,
      modifiers: verifiedModifiers,
    });
  }

  if (order.channel === 'partner_meal' && partnerIds.size !== 1) {
    throw new OrderPricingError(
      'Partner meal orders must contain items from exactly one partner',
      'PARTNER_ORDER_MISMATCH',
      [{ path: 'items', message: 'Choose meals from one partner at a time' }],
    );
  }
  let partnerSchedule = null;
  if (order.channel === 'partner_meal') {
    if (partnerDeliveryDates.size !== 1) {
      throw new OrderPricingError(
        'Partner meal orders must use one weekly delivery menu',
        'PARTNER_SCHEDULE_MISMATCH',
        [{ path: 'items', message: 'Choose meals from one delivery week' }],
      );
    }
    partnerSchedule = partnerScheduleForDelivery([...partnerDeliveryDates][0]);
    if (new Date(now) >= partnerSchedule.deadline) {
      const error = new OrderPricingError(
        'Weekly meal pre-orders closed Wednesday at 12:00 PM Pacific',
        'PARTNER_PREORDER_CLOSED',
        [{ path: 'items', message: 'This weekly pre-order window has closed' }],
      );
      error.status = 409;
      throw error;
    }
  }
  const taxSetting = order.channel === 'partner_meal' ? 'partner_tax_rate' : 'tax_rate';
  const taxFallback = order.channel === 'partner_meal' ? '0.08375' : '0.0825';
  const taxRate = parseTaxRate(await db.getSetting(taxSetting) ?? taxFallback);
  const taxIncluded = order.channel === 'partner_meal';
  const subtotalCents = taxIncluded
    ? Math.round(listedPriceTotalCents / (1 + taxRate))
    : listedPriceTotalCents;
  const taxCents = taxIncluded
    ? listedPriceTotalCents - subtotalCents
    : Math.round(subtotalCents * taxRate);
  const totalCents = taxIncluded ? listedPriceTotalCents : subtotalCents + taxCents;
  return {
    normalized,
    requestHash: hashOrderRequest(normalized),
    items: verifiedItems,
    subtotalCents,
    taxCents,
    totalCents,
    taxIncluded,
    partnerId: order.channel === 'partner_meal' ? [...partnerIds][0] : null,
    partnerDeliveryDate: partnerSchedule?.deliveryDate || null,
    partnerOrderDeadline: partnerSchedule?.deadline.toISOString() || null,
  };
}
