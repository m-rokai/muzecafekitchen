import assert from 'node:assert/strict';
import test from 'node:test';
import { isAuthorized, safeEqual } from './marketingCampaign.js';

test('campaign trigger uses constant-time exact bearer matching', () => {
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('same', 'different'), false);

  const previous = process.env.CAMPAIGN_TRIGGER_SECRET;
  process.env.CAMPAIGN_TRIGGER_SECRET = 'campaign-secret';
  try {
    assert.equal(isAuthorized({ get: () => 'Bearer campaign-secret' }), true);
    assert.equal(isAuthorized({ get: () => 'Bearer wrong-secret' }), false);
  } finally {
    if (previous === undefined) delete process.env.CAMPAIGN_TRIGGER_SECRET;
    else process.env.CAMPAIGN_TRIGGER_SECRET = previous;
  }
});

