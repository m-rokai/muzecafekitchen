import assert from 'node:assert/strict';
import test from 'node:test';
import {
  providerForChannel,
  providerIdempotencyKey,
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
