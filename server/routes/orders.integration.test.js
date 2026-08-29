import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { runMigrations } from '../db/migrations.js';

const SERVER_ROOT = fileURLToPath(new URL('../', import.meta.url));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function waitForServer(child) {
  let output = '';
  let timer;
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      output += chunk;
      if (output.includes('Server running on')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      if (!output.includes('Server running on')) {
        clearTimeout(timer);
        reject(new Error(`server exited before startup (${code ?? signal}): ${output}`));
      }
    });
    timer = setTimeout(() => {
      reject(new Error(`server startup timed out: ${output}`));
    }, 10000);
  });
}

async function request(base, pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

test('order API enforces replay, ownership, cancellation, and legal staff status flow', async (t) => {
  const port = 3400 + (process.pid % 500);
  const child = spawn(process.execPath, ['index.js'], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CUSTOMER_AUTH_MODE: 'dev-header',
      INITIAL_ADMIN_PIN: '2468',
      JWT_SECRET: 'integration-test-secret-that-is-long-enough',
      DATABASE_PATH: ':memory:',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  await waitForServer(child);

  const base = `http://127.0.0.1:${port}/api`;
  const { body: menu } = await request(base, '/menu/items');
  const item = menu?.[0];
  assert.ok(item?.id, 'seeded menu should contain an item');

  const { response: pinResponse, body: pinBody } = await request(base, '/admin/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ pin: '2468' }),
  });
  assert.equal(pinResponse.status, 200);
  const staffHeaders = { Authorization: `Bearer ${pinBody.token}` };
  const customerSubject = 'integration-customer-a';
  const customerHeaders = { 'X-Dev-Customer-Subject': customerSubject };
  const idempotencyKey = 'integration-key-replay-001';
  const payload = {
    customerName: 'Integration Customer',
    email: 'integration@example.com',
    items: [{ menu_item_id: item.id, quantity: 1, modifiers: [] }],
  };

  const createdResult = await request(base, '/orders', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  assert.equal(createdResult.response.status, 201);
  assert.match(createdResult.body.public_id, UUID_PATTERN);

  const unavailableResult = await request(base, `/admin/items/${item.id}/availability`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ available: false }),
  });
  assert.equal(unavailableResult.response.status, 200);

  const replayResult = await request(base, '/orders', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  assert.equal(replayResult.response.status, 200);
  assert.equal(replayResult.body.replayed, true);
  assert.equal(replayResult.body.public_id, createdResult.body.public_id);

  const conflictResult = await request(base, '/orders', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ ...payload, items: [{ menu_item_id: item.id, quantity: 2, modifiers: [] }] }),
  });
  assert.equal(conflictResult.response.status, 409);
  assert.equal(conflictResult.body.code, 'IDEMPOTENCY_KEY_CONFLICT');

  await request(base, `/admin/items/${item.id}/availability`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ available: true }),
  });

  const ownResult = await request(base, `/orders/${createdResult.body.public_id}`, {
    headers: customerHeaders,
  });
  assert.equal(ownResult.response.status, 200);
  assert.equal(ownResult.body.public_id, createdResult.body.public_id);
  assert.equal(ownResult.body.id, undefined);

  const otherResult = await request(base, `/orders/${createdResult.body.public_id}`, {
    headers: { 'X-Dev-Customer-Subject': 'integration-customer-b' },
  });
  assert.equal(otherResult.response.status, 404);

  const preparingResult = await request(base, `/orders/${createdResult.body.public_id}/status`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'preparing' }),
  });
  assert.equal(preparingResult.response.status, 200);

  const backwardsResult = await request(base, `/orders/${createdResult.body.public_id}/status`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'pending' }),
  });
  assert.equal(backwardsResult.response.status, 409);
  assert.equal(backwardsResult.body.code, 'invalid_transition');

  const readyResult = await request(base, `/orders/${createdResult.body.public_id}/status`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'ready' }),
  });
  assert.equal(readyResult.response.status, 200);

  const completedResult = await request(base, `/orders/${createdResult.body.public_id}/status`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(completedResult.response.status, 200);

  const cancelledPayload = {
    customerName: 'Cancellation Customer',
    items: [{ menu_item_id: item.id, quantity: 1, modifiers: [] }],
  };
  const cancelledCreate = await request(base, '/orders', {
    method: 'POST',
    headers: { ...customerHeaders, 'Idempotency-Key': 'integration-key-cancel-001' },
    body: JSON.stringify(cancelledPayload),
  });
  assert.equal(cancelledCreate.response.status, 201);
  const cancelledResult = await request(base, `/orders/${cancelledCreate.body.public_id}/cancel`, {
    method: 'PATCH',
    headers: customerHeaders,
    body: JSON.stringify({ reason: 'No longer needed' }),
  });
  assert.equal(cancelledResult.response.status, 200);
  assert.equal(cancelledResult.body.order.status, 'cancelled');

  const cancelledTransition = await request(base, `/orders/${cancelledCreate.body.public_id}/status`, {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ status: 'preparing' }),
  });
  assert.equal(cancelledTransition.response.status, 409);
  assert.equal(cancelledTransition.body.code, 'invalid_transition');
});

test('fresh in-memory migrations are self-contained and omit the known default PIN', () => {
  const database = new Database(':memory:');
  try {
    runMigrations(database);
    const columns = new Set(database.prepare('PRAGMA table_info(orders)').all().map(column => column.name));
    assert.ok(columns.has('public_id'));
    assert.ok(columns.has('payment_method'));
    assert.equal(database.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").get(), undefined);
    assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally {
    database.close();
  }
});

test('upgrade migration backfills unique public IDs and removes the legacy default PIN', () => {
  const database = new Database(':memory:');
  try {
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO schema_migrations (version, name) VALUES
        (1, 'baseline-schema'), (2, 'revival-customer-order-domain'),
        (3, 'seed-generated-menu-image-urls');
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        public_id TEXT,
        payment_status TEXT
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO orders (id, public_id, payment_status) VALUES
        (1, 'duplicate-public-id', 'unpaid'),
        (2, 'duplicate-public-id', 'unpaid'),
        (3, NULL, 'unpaid');
      INSERT INTO settings (key, value) VALUES ('admin_pin', '7890');
    `);

    runMigrations(database);
    const ids = database.prepare('SELECT public_id FROM orders ORDER BY id').all().map(row => row.public_id);
    assert.equal(new Set(ids).size, 3);
    assert.ok(ids.every(id => UUID_PATTERN.test(id)));
    assert.equal(database.prepare("SELECT value FROM settings WHERE key = 'admin_pin'").get(), undefined);
    assert.ok(database.prepare('PRAGMA index_list(orders)').all()
      .some(index => index.name === 'idx_orders_public_id_unique' && index.unique === 1));
  } finally {
    database.close();
  }
});
