import assert from 'node:assert/strict';
import test from 'node:test';
import {
  providerForChannel,
  providerIdempotencyKey,
  squarePaymentNote,
  squareStatus,
} from './payments.js';

test('only routes new café orders to Square', () => {
  assert.equal(providerForChannel('cafe'), 'square');
  assert.throws(() => providerForChannel('partner_meal'));
});

test('normalizes provider payment states conservatively', () => {
  assert.equal(squareStatus('COMPLETED'), 'paid');
  assert.equal(squareStatus('APPROVED'), 'authorized');
  assert.equal(squareStatus('FAILED'), 'failed');
});

test('creates deterministic Square-compatible idempotency keys', () => {
  const first = providerIdempotencyKey('square:customer:order:attempt');
  const replay = providerIdempotencyKey('square:customer:order:attempt');
  const nextAttempt = providerIdempotencyKey('square:customer:order:new-attempt');

  assert.equal(first, replay);
  assert.notEqual(first, nextAttempt);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.ok(first.length <= 45);
});

test('marks scheduled and ASAP pickup timing in the Square payment record', () => {
  assert.equal(
    squarePaymentNote({ pickup_number: 7, pickup_window_start: '2026-09-14T18:30:00.000Z' }),
    'Muze Café pickup #007 · Scheduled 11:30 AM PDT',
  );
  assert.equal(squarePaymentNote({ pickup_number: 8 }), 'Muze Café pickup #008 · ASAP');
});
