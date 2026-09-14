import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildUnsubscribeMailto,
  buildUnsubscribeUrl,
  parseCampaignRecipients,
  recipientHash,
  renderCampaignEmail,
} from './marketingCampaign.js';

test('recipient CSV is normalized and deduplicated', () => {
  const recipients = parseCampaignRecipients([
    'email,order_count',
    ' Person@Example.com ,2',
    'person@example.com,4',
    'second@example.com,1',
  ].join('\n'));

  assert.deepEqual(recipients, [
    { email: 'person@example.com' },
    { email: 'second@example.com' },
  ]);
});

test('recipient CSV rejects invalid addresses', () => {
  assert.throws(
    () => parseCampaignRecipients('email\nnot-an-email\n'),
    /CSV row\(s\): 2/,
  );
});

test('campaign template renders required compliance fields', () => {
  const unsubscribeUrl = buildUnsubscribeUrl(
    'https://muzecafe.vercel.app',
    '123e4567-e89b-42d3-a456-426614174000',
  );
  const html = renderCampaignEmail(
    '<a href="{{unsubscribe_url}}">Unsubscribe</a><p>{{business_mailing_address}}</p>',
    {
      businessMailingAddress: '123 Main & Market, Las Vegas, NV',
      unsubscribeUrl,
    },
  );

  assert.match(html, /https:\/\/muzecafe\.vercel\.app\/api\/email\/unsubscribe/);
  assert.match(html, /123 Main &amp; Market/);
  assert.match(buildUnsubscribeMailto('notifications@muzeoffice.com'), /^mailto:/);
});

test('campaign recipient hashes are stable and campaign-specific', () => {
  assert.equal(
    recipientHash('reopening', 'PERSON@example.com'),
    recipientHash('reopening', 'person@example.com'),
  );
  assert.notEqual(
    recipientHash('reopening', 'person@example.com'),
    recipientHash('another-campaign', 'person@example.com'),
  );
});
