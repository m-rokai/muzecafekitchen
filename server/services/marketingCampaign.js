import crypto from 'node:crypto';
import { parse } from 'csv-parse/sync';

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function parseCampaignRecipients(csvText) {
  const records = parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  const recipients = [];
  const seen = new Set();
  const invalidRows = [];

  records.forEach((record, index) => {
    const email = normalizeEmail(record.email);
    if (!EMAIL_PATTERN.test(email)) {
      invalidRows.push(index + 2);
      return;
    }
    if (seen.has(email)) return;
    seen.add(email);
    recipients.push({ email });
  });

  if (invalidRows.length) {
    throw new Error(`Invalid or missing email address on CSV row(s): ${invalidRows.join(', ')}`);
  }
  if (!recipients.length) {
    throw new Error('The recipient CSV does not contain any valid email addresses.');
  }

  return recipients;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export function buildUnsubscribeMailto(unsubscribeEmail) {
  const email = normalizeEmail(unsubscribeEmail);
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('CAMPAIGN_UNSUBSCRIBE_EMAIL must be a valid email address.');
  }
  return `mailto:${email}?subject=${encodeURIComponent('Unsubscribe from Muze Café updates')}`;
}

export function buildUnsubscribeUrl(publicSiteUrl, token) {
  const base = new URL(publicSiteUrl);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') {
    throw new Error('PUBLIC_SITE_URL must use HTTPS.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    throw new Error('A valid unsubscribe token is required.');
  }
  return new URL(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`, base).toString();
}

export function renderCampaignEmail(template, { businessMailingAddress, unsubscribeUrl }) {
  if (!String(businessMailingAddress ?? '').trim()) {
    throw new Error('CAMPAIGN_BUSINESS_MAILING_ADDRESS is required before sending.');
  }
  const parsedUrl = new URL(unsubscribeUrl);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new Error('The unsubscribe URL must use HTTPS.');
  }
  const html = template
    .replaceAll('{{business_mailing_address}}', escapeHtml(businessMailingAddress))
    .replaceAll('{{unsubscribe_url}}', escapeHtml(unsubscribeUrl));

  if (/{{[^}]+}}/.test(html)) {
    throw new Error('The email template still contains an unresolved placeholder.');
  }

  return html;
}

export function recipientHash(campaignId, email) {
  return crypto
    .createHash('sha256')
    .update(`${campaignId}:${normalizeEmail(email)}`)
    .digest('hex');
}

export function maskEmail(email) {
  const [local = '', domain = ''] = normalizeEmail(email).split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}
