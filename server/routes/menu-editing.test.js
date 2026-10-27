import assert from 'node:assert/strict';
import { after, before, mock, test } from 'node:test';
import { once } from 'node:events';
import { auth, database, tokens } from '../test-support/cafeFixture.js';

const writes = [];
process.env.DOTENV_CONFIG_PATH = '/dev/null';
mock.module('../db/database.js', { namedExports: {
  ...database,
  createMenuItem: async data => { writes.push({ operation: 'create', data }); return 3; },
  updateMenuItem: async (id, data) => { writes.push({ operation: 'update', id, data }); },
  setItemModifierGroups: async () => { throw new Error('Item and modifier assignments must be saved together'); },
} });
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

async function save(path, method, body) {
  const response = await fetch(`${origin}/api/admin${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.admin}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test('creating an item sends its photo and modifier groups to one database save', async () => {
  writes.length = 0;
  const imageUrl = 'https://example.supabase.co/storage/v1/object/public/menu-images/menu-test.webp';
  const result = await save('/items', 'POST', {
    name: 'Latte', price: 5.5, image_url: imageUrl, modifier_group_ids: [1],
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.id, 3);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data.image_url, imageUrl);
  assert.deepEqual(writes[0].data.modifier_group_ids, [1]);
});

test('editing only a photo does not send defaults that reset existing item fields', async () => {
  writes.length = 0;
  assert.equal((await save('/items/1', 'PUT', { image_url: null })).status, 200);
  assert.deepEqual(writes, [{ operation: 'update', id: 1, data: { image_url: null } }]);
});

test('an explicit empty modifier selection is saved with the item', async () => {
  writes.length = 0;
  assert.equal((await save('/items/1', 'PUT', { name: 'New latte', modifier_group_ids: [] })).status, 200);
  assert.deepEqual(writes, [{ operation: 'update', id: 1, data: { name: 'New latte', modifier_group_ids: [] } }]);
});

test('invalid modifier selections fail before any item fields are written', async () => {
  writes.length = 0;
  const result = await save('/items/1', 'PUT', { name: 'Changed', modifier_group_ids: [null] });
  assert.equal(result.status, 400);
  assert.equal(result.body.errors[0].path, 'modifier_group_ids.0');
  assert.deepEqual(writes, []);
});
