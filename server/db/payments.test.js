import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the DB module at a throwaway file BEFORE importing it.
const tmpDb = path.join(os.tmpdir(), `muze-pay-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = tmpDb;
const db = await import('./database.js');

after(() => {
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + ext); } catch { /* ignore */ }
  }
});

test('new orders are unpaid and excluded from the kitchen queue', () => {
  const { id } = db.createOrder({ customer_name: 'Test', email: null, subtotal: 10, tax: 0.82, total: 10.82, notes: null });
  const order = db.getOrder(id);
  assert.equal(order.payment_status, 'unpaid');
  const active = db.getActiveOrders().map(o => o.id);
  assert.ok(!active.includes(id), 'unpaid order must not appear in the kitchen queue');
});

test('markOrderPaid is idempotent and records one payment', () => {
  const { id } = db.createOrder({ customer_name: 'Pay', email: null, subtotal: 5, tax: 0.41, total: 5.41, notes: null });

  const first = db.markOrderPaid(id, { sessionId: 'cs_1', paymentIntentId: 'pi_1', amountCents: 541 });
  assert.equal(first.alreadyPaid, false);
  assert.equal(first.order.payment_status, 'paid');

  const second = db.markOrderPaid(id, { sessionId: 'cs_1', paymentIntentId: 'pi_1', amountCents: 541 });
  assert.equal(second.alreadyPaid, true);

  const paid = db.getActiveOrders().map(o => o.id);
  assert.ok(paid.includes(id), 'paid order must appear in the kitchen queue');
});
