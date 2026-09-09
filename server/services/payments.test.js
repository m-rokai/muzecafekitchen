import assert from 'node:assert/strict';
import test from 'node:test';
import { providerForChannel, squareStatus, stripeStatus } from './payments.js';

test('only routes new café orders to Square', () => {
  assert.equal(providerForChannel('cafe'), 'square');
  assert.throws(() => providerForChannel('partner_meal'));
});

test('normalizes provider payment states conservatively', () => {
  assert.equal(squareStatus('COMPLETED'), 'paid');
  assert.equal(squareStatus('APPROVED'), 'authorized');
  assert.equal(squareStatus('FAILED'), 'failed');
  assert.equal(stripeStatus({ payment_status: 'paid' }), 'paid');
  assert.equal(stripeStatus({ payment_status: 'unpaid', status: 'open' }), 'pending');
  assert.equal(stripeStatus({ payment_status: 'unpaid', status: 'expired' }), 'failed');
});
