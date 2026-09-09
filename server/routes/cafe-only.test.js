import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { once } from 'node:events';
import { auth, database, databaseCalls, historicalOrder, tokens } from '../test-support/cafeFixture.js';

// Exercise real routing, authorization, and response filtering with no hosted
// database, account, import, or payment access.
process.env.DOTENV_CONFIG_PATH = '/dev/null';
mock.module('../db/database.js', { namedExports: database });
mock.module('../lib/supabase.js', { namedExports: auth });
const { default: app } = await import('../app.js');
let server;
let origin;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));

async function request(path, { role, method = 'GET', body } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

test('café catalog and modifiers remain available; retired items cannot be read by ID', async () => {
  for (const path of ['/menu/items', '/menu/items?channel=cafe', '/menu/categories', '/menu/categories/1/items']) {
    const result = await request(path);
    assert.equal(result.status, 200, path);
    assert.deepEqual(result.body.map(row => row.id), [1], path);
  }
  assert.equal((await request('/menu/items/1')).status, 200);
  assert.equal((await request('/menu/items/1/modifiers')).body[0].options[0].name, 'Oat milk');
  for (const path of ['/menu/items/2', '/menu/items/2/modifiers']) {
    assert.equal((await request(path)).status, 404, path);
  }
});

test('retired menu queries and order submissions stop before catalog or payment work', async () => {
  databaseCalls.length = 0;
  for (const path of ['/menu/items', '/menu/categories', '/menu/categories/2/items', '/menu/items/2', '/admin/public/settings']) {
    const result = await request(`${path}?channel=partner_meal`);
    assert.equal(result.status, 410, path);
    assert.equal(result.body.code, 'STOREFRONT_UNAVAILABLE');
  }
  const result = await request('/orders', { method: 'POST', body: {
    channel: 'partner_meal', customerName: 'Customer', email: 'test@example.com',
    items: [{ menu_item_id: 2, quantity: 1, modifiers: [] }],
  } });
  assert.equal(result.status, 410);
  assert.deepEqual(databaseCalls, []);
  assert.equal((await request('/menu/items?channel=unknown')).status, 400);
});

test('featured items, admin catalog, and kitchen serve café records only', async () => {
  assert.deepEqual((await request('/admin/public/popular-items')).body.map(item => item.id), [1]);
  for (const path of ['/admin/items', '/admin/categories']) {
    const result = await request(path, { role: 'admin' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.map(item => item.id), [1]);
  }
  for (const method of ['GET', 'PUT', 'DELETE']) {
    assert.equal((await request('/admin/items/2', { method, role: 'admin', body: method === 'PUT' ? { available: true } : undefined })).status, 404);
    assert.equal((await request('/admin/categories/2', { method, role: 'admin' })).status, 404);
  }
  assert.equal((await request('/admin/items/2/availability', { method: 'PATCH', role: 'admin', body: { available: true } })).status, 404);
  assert.equal((await request('/orders/active', { role: 'staff' })).status, 200);
  assert.equal((await request('/orders/active?channel=partner_meal', { role: 'staff' })).status, 410);
});

test('retired import routes are absent even for an administrator', async () => {
  for (const [path, method] of [
    ['/cron/partner-menu', 'GET'],
    ['/admin/partner-menu/imports', 'GET'],
    ['/admin/partner-menu/imports/refresh', 'POST'],
    ['/admin/partner-menu/imports/example/candidates', 'GET'],
    ['/admin/partner-menu/imports/example/publish', 'POST'],
  ]) assert.equal((await request(path, { method, role: 'admin' })).status, 404, path);
  const health = await request('/health');
  assert.equal(health.status, 200);
  assert.equal('partnerMenuImport' in health.body.features, false);
  assert.deepEqual(Object.keys(health.body.features.payments), ['square']);
});

test('café authentication and historical order ownership remain enforced', async () => {
  assert.equal((await request('/orders', { method: 'POST', body: { channel: 'cafe' } })).status, 401);
  assert.equal((await request('/admin/items')).status, 401);
  assert.equal((await request('/admin/items', { role: 'staff' })).status, 403);
  assert.equal((await request(`/orders/${historicalOrder.public_id}`)).status, 401);
  const history = await request(`/orders/${historicalOrder.public_id}`, { role: 'customer' });
  assert.equal(history.status, 200);
  assert.equal(history.body.channel, 'partner_meal');
  assert.equal(history.body.customer_id, undefined);
});
