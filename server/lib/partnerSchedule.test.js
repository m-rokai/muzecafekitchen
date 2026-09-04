import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryDateFromSource, partnerScheduleForDelivery } from './partnerSchedule.js';

test('maps the source cutoff to the following Monday delivery', () => {
  const deliveryDate = deliveryDateFromSource({
    sourceMenuDate: '2026-09-13',
    sourceCutoff: '2026-09-09T12:00:00-07:00',
  });
  const schedule = partnerScheduleForDelivery(deliveryDate);
  assert.equal(schedule.deliveryDate, '2026-09-14');
  assert.equal(schedule.deadlineDate, '2026-09-09');
  assert.equal(schedule.deadline.toISOString(), '2026-09-09T19:00:00.000Z');
});

test('keeps Wednesday noon in Pacific time across winter daylight offset', () => {
  const schedule = partnerScheduleForDelivery('2026-12-14');
  assert.equal(schedule.deadline.toISOString(), '2026-12-09T20:00:00.000Z');
});
