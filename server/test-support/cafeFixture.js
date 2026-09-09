// Synthetic records shared by the café API regression tests and local UI review.
export const cafeItem = {
  id: 1, name: 'Latte', description: 'Espresso with steamed milk.',
  channel: 'cafe', category_id: 1, category_name: 'Coffee',
  price: 5.5, price_cents: 550, available: 1, has_modifiers: true,
};
export const retiredItem = {
  id: 2, name: 'Retired weekly meal', channel: 'partner_meal',
  category_id: 2, price: 20.59, price_cents: 2059, available: 1,
};
const categories = [
  { id: 1, name: 'Coffee', channel: 'cafe', sort_order: 0 },
  { id: 2, name: 'Retired meals', channel: 'partner_meal', sort_order: 1 },
];
const modifierGroups = [{
  id: 1, name: 'Milk', display_name: 'Milk', min_selections: 0,
  max_selections: 1, required: 0,
  options: [{ id: 10, group_id: 1, name: 'Oat milk', available: 1,
    price_adjustment: 0.75, price_adjustment_cents: 75 }],
}];
const settings = {
  tax_rate: '0.0825', kitchen_open: 'true', kitchen_closed_message: '',
  announcement_enabled: 'false', announcement_text: '', popular_item_ids: '[1,2]',
};
export const historicalOrder = {
  id: 2, public_id: '3e9605ef-6455-4444-8888-26f8da5b15e4', customer_id: 1,
  channel: 'partner_meal', customer_name: 'Test Customer', email: 'test@example.com',
  pickup_number: 42, status: 'completed', payment_status: 'paid', payment_provider: 'stripe',
  created_at: '2026-09-02T20:00:00Z', subtotal: 19, tax: 1.59, total: 20.59,
  items: [{ quantity: 1, item_name: retiredItem.name, total_price: 20.59 }],
};

const copy = value => structuredClone(value);
export const databaseCalls = [];
const record = (name, args) => databaseCalls.push({ name, args });
const unexpectedWrite = () => { throw new Error('Unexpected database write in a read-only fixture'); };

export const database = {
  checkDatabaseIntegrity: async () => 'ok',
  getSetting: async key => { record('getSetting', [key]); return settings[key] ?? null; },
  getAllSettings: async () => copy(settings),
  getAllCategories: async channel => {
    record('getAllCategories', [channel]);
    return copy(categories.filter(category => !channel || category.channel === channel));
  },
  getCategory: async id => copy(categories.find(category => category.id === id) || null),
  getAllMenuItems: async channel => {
    record('getAllMenuItems', [channel]);
    return copy([cafeItem, retiredItem].filter(item => item.channel === channel));
  },
  getAllMenuItemsIncludingUnavailable: async () => copy([cafeItem, retiredItem]),
  getMenuItemsByCategory: async (id, channel) => {
    record('getMenuItemsByCategory', [id, channel]);
    return copy([cafeItem, retiredItem].filter(item => item.category_id === id && item.channel === channel));
  },
  getMenuItem: async id => {
    record('getMenuItem', [id]);
    return copy([cafeItem, retiredItem].find(item => item.id === id) || null);
  },
  getModifiersForItem: async id => id === 1 ? copy(modifierGroups) : [],
  getAllModifierGroups: async () => copy(modifierGroups),
  getModifierOptions: async () => copy(modifierGroups[0].options),
  getAllModifierOptions: async () => copy(modifierGroups[0].options),
  getActiveOrders: async channel => { record('getActiveOrders', [channel]); return []; },
  getTodayOrderCount: async () => 0,
  getTodayRevenue: async () => 0,
  getOrderByPublicId: async id => id === historicalOrder.public_id ? copy(historicalOrder) : null,
  getCustomerBySubject: async subject => subject === 'fixture-customer' ? { id: 1 } : null,
  getOrder: async id => id === historicalOrder.id ? copy(historicalOrder) : null,
  getOrderHistory: async () => ({ orders: [copy(historicalOrder)], total: 1 }),
  getOrderStats: async () => ({ total_orders: 1, total_revenue: 20.59 }),
  updateMenuItem: unexpectedWrite,
  deleteMenuItem: unexpectedWrite,
  setItemModifierGroups: unexpectedWrite,
  updateCategory: unexpectedWrite,
  deleteCategory: unexpectedWrite,
};

export const users = {
  admin: { id: 'fixture-admin', email: 'admin@example.com', app_metadata: { role: 'admin' } },
  staff: { id: 'fixture-staff', email: 'staff@example.com', app_metadata: { role: 'staff' } },
  customer: { id: 'fixture-customer', email: 'test@example.com', app_metadata: {}, is_anonymous: true },
};
export const tokens = Object.fromEntries(Object.entries(users).map(([role, user]) => [role,
  `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({
    sub: user.id, exp: 4102444800, role: 'authenticated', app_metadata: user.app_metadata,
  })).toString('base64url')}.local-test-signature`,
]));
export const auth = {
  verifyAccessToken: async token => {
    const role = Object.keys(tokens).find(key => tokens[key] === token);
    return role ? copy(users[role]) : null;
  },
  getSupabaseAdminClient: unexpectedWrite,
};
