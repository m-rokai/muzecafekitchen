import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CafeScheduleError,
  getAvailablePickupSlots,
  getCafeOrderingStatus,
  resolveCafePickupWindow,
} from './orderSchedule.js';

test('accepts order submissions only from 8 AM until 2 PM Pacific across DST', () => {
  assert.equal(getCafeOrderingStatus('2026-01-15T15:59:59Z').acceptingOrders, false);
  assert.equal(getCafeOrderingStatus('2026-01-15T16:00:00Z').acceptingOrders, true);
  assert.equal(getCafeOrderingStatus('2026-01-15T22:00:00Z').acceptingOrders, false);
  assert.equal(getCafeOrderingStatus('2026-07-15T15:00:00Z').acceptingOrders, true);
  assert.equal(getCafeOrderingStatus('2026-07-15T21:00:00Z').acceptingOrders, false);
});

test('offers same-day quarter-hour pickup slots with a 15-minute lead', () => {
  const slots = getAvailablePickupSlots('2026-09-14T17:07:00Z'); // 10:07 AM PDT
  assert.equal(slots[0].value, '2026-09-14T17:30:00.000Z');
  assert.equal(slots[0].label, '10:30 AM PDT');
  assert.equal(slots.at(-1).label, '2:00 PM PDT');
});

test('resolves ASAP and validates scheduled pickup server-side', () => {
  assert.deepEqual(resolveCafePickupWindow(null, '2026-09-14T17:00:00Z'), {
    pickupWindowStart: null,
    pickupWindowEnd: null,
  });
  assert.deepEqual(resolveCafePickupWindow('2026-09-14T18:15:00.000Z', '2026-09-14T17:00:00Z'), {
    pickupWindowStart: '2026-09-14T18:15:00.000Z',
    pickupWindowEnd: '2026-09-14T18:30:00.000Z',
  });
  assert.throws(
    () => resolveCafePickupWindow('2026-09-14T17:10:00.000Z', '2026-09-14T17:00:00Z'),
    error => error instanceof CafeScheduleError && error.code === 'PICKUP_TIME_UNAVAILABLE',
  );
  assert.throws(
    () => resolveCafePickupWindow(null, '2026-09-14T21:00:00Z'),
    error => error instanceof CafeScheduleError && error.code === 'ORDERING_CLOSED',
  );
});
