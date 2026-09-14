import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanCampaignAudience } from './reopeningCampaign.js';

test('campaign audience keeps customers and excludes placeholders and operators', () => {
  const audience = cleanCampaignAudience([
    { email: ' Customer@Example.com ' },
    { email: 'customer@example.com' },
    { email: 'legacy-orders-1@invalid.local' },
    { email: 'robert.mai@muzeoffice.com' },
    { email: 'robertkma99@gmail.com' },
    { email: 'not-an-email' },
  ]);

  assert.deepEqual(audience, ['customer@example.com']);
});

