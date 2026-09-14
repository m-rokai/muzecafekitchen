import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import {
  buildUnsubscribeMailto,
  buildUnsubscribeUrl,
  maskEmail,
  normalizeEmail,
  renderCampaignEmail,
} from './marketingCampaign.js';

const EXPECTED_SENDER = 'notifications@muzeoffice.com';
const TEST_RECIPIENT = 'robert.mai@muzeoffice.com';
const CAMPAIGN_ID = 'muze-reopening-2026';
const TEST_CAMPAIGN_ID = `${CAMPAIGN_ID}-test`;
const SUBJECT = 'We’re back at Muze ☕ Meet the new café menu';
const DEFAULT_DELAY_MS = 1500;
const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const EXCLUDED_CUSTOMER_EMAILS = new Set([
  'info@cussworthy.cafe',
  'cussworthycafe@gmail.com',
  'robert.mai@muzeoffice.com',
  'robertkma99@gmail.com',
]);
const templatePath = fileURLToPath(new URL('../emails/reopening-marketing.html', import.meta.url));

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function recordDelivery(supabase, delivery) {
  const { error } = await supabase
    .from('marketing_campaign_deliveries')
    .upsert(delivery, { onConflict: 'campaign_id,email' });
  if (error) throw error;
}

async function prepareContacts(supabase, emails, campaignId) {
  const { error: contactError } = await supabase
    .from('marketing_contacts')
    .upsert(emails.map(email => ({ email })), {
      onConflict: 'email',
      ignoreDuplicates: true,
    });
  if (contactError) throw contactError;

  const { data: contacts, error: selectError } = await supabase
    .from('marketing_contacts')
    .select('email, unsubscribe_token, unsubscribed_at')
    .in('email', emails);
  if (selectError) throw selectError;
  if (contacts.length !== emails.length) {
    throw new Error('Supabase did not return every campaign contact.');
  }

  const { data: deliveries, error: deliveryError } = await supabase
    .from('marketing_campaign_deliveries')
    .select('email, status, attempts')
    .eq('campaign_id', campaignId)
    .in('email', emails);
  if (deliveryError) throw deliveryError;

  const deliveryByEmail = new Map(deliveries.map(delivery => [delivery.email, delivery]));
  return contacts.map(contact => ({
    ...contact,
    delivery: deliveryByEmail.get(contact.email) || null,
  }));
}

export function cleanCampaignAudience(orderRows) {
  const emails = new Set();
  for (const row of orderRows) {
    const email = normalizeEmail(row.email);
    if (!EMAIL_PATTERN.test(email)) continue;
    if (email.endsWith('@invalid.local')) continue;
    if (EXCLUDED_CUSTOMER_EMAILS.has(email)) continue;
    emails.add(email);
  }
  return [...emails].sort();
}

async function customerAudience(supabase) {
  const { data, error } = await supabase
    .from('orders')
    .select('email')
    .eq('channel', 'cafe');
  if (error) throw error;
  return cleanCampaignAudience(data);
}

export async function runReopeningCampaign({ mode, delayMs = DEFAULT_DELAY_MS, logger = console }) {
  if (!['test', 'campaign'].includes(mode)) {
    throw new Error('Campaign mode must be test or campaign.');
  }
  if (!Number.isInteger(delayMs) || delayMs < 1000) {
    throw new Error('Campaign delay must be at least 1000 milliseconds.');
  }

  const sender = normalizeEmail(required('GMAIL_USER'));
  if (sender !== EXPECTED_SENDER) {
    throw new Error(`GMAIL_USER must be ${EXPECTED_SENDER} for this campaign.`);
  }
  const appPassword = required('GMAIL_APP_PASSWORD');
  const businessMailingAddress = required('CAMPAIGN_BUSINESS_MAILING_ADDRESS');
  const unsubscribeEmail = normalizeEmail(
    process.env.CAMPAIGN_UNSUBSCRIBE_EMAIL || EXPECTED_SENDER,
  );
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL || 'https://muzecafe.vercel.app').replace(/\/$/, '');
  const fromName = process.env.GMAIL_FROM_NAME || 'Cuss Worthy Café at Muze';
  const campaignId = mode === 'test' ? TEST_CAMPAIGN_ID : CAMPAIGN_ID;
  const supabase = getSupabaseAdminClient();
  const emails = mode === 'test' ? [TEST_RECIPIENT] : await customerAudience(supabase);
  const expectedCount = mode === 'test' ? 1 : 62;
  if (emails.length !== expectedCount) {
    throw new Error(`Campaign audience changed: expected ${expectedCount}, found ${emails.length}.`);
  }

  const contacts = await prepareContacts(supabase, emails, campaignId);
  const template = await fs.readFile(templatePath, 'utf8');
  const unsubscribeMailto = buildUnsubscribeMailto(unsubscribeEmail);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: sender, pass: appPassword },
  });
  await transporter.verify();

  const summary = {
    campaignId,
    mode,
    audience: contacts.length,
    sent: 0,
    previouslySent: 0,
    suppressed: 0,
    uncertain: 0,
    failed: 0,
  };

  for (let index = 0; index < contacts.length; index += 1) {
    const recipient = contacts[index];
    if (recipient.unsubscribed_at) {
      summary.suppressed += 1;
      continue;
    }
    if (recipient.delivery?.status === 'sent') {
      summary.previouslySent += 1;
      continue;
    }
    if (recipient.delivery?.status === 'pending') {
      summary.uncertain += 1;
      logger.warn(`Skipped uncertain prior attempt for ${maskEmail(recipient.email)}`);
      continue;
    }

    const attempts = (recipient.delivery?.attempts || 0) + 1;
    try {
      await recordDelivery(supabase, {
        campaign_id: campaignId,
        email: recipient.email,
        status: 'pending',
        attempts,
        message_id: null,
        last_error: null,
        sent_at: null,
        updated_at: new Date().toISOString(),
      });

      const unsubscribeUrl = buildUnsubscribeUrl(publicSiteUrl, recipient.unsubscribe_token);
      const html = renderCampaignEmail(template, {
        businessMailingAddress,
        unsubscribeUrl,
      });
      const info = await transporter.sendMail({
        from: `"${fromName.replaceAll('"', '')}" <${sender}>`,
        to: recipient.email,
        subject: SUBJECT,
        html,
        text: [
          'Welcome back! Muze Café is reopening with Cuss Worthy Café.',
          'Browse the refreshed breakfast, lunch, coffee, and matcha menu:',
          publicSiteUrl,
          '',
          `Unsubscribe from marketing emails: ${unsubscribeUrl}`,
          businessMailingAddress,
        ].join('\n'),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>, <${unsubscribeMailto}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Campaign-ID': campaignId,
        },
      });

      summary.sent += 1;
      logger.info(`Sent reopening email to ${maskEmail(recipient.email)}`);
      try {
        await recordDelivery(supabase, {
          campaign_id: campaignId,
          email: recipient.email,
          status: 'sent',
          attempts,
          message_id: info.messageId,
          last_error: null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch (recordError) {
        // Leave the pre-send row as pending. A later invocation deliberately
        // skips pending rows, preventing a duplicate after Gmail accepted it.
        summary.uncertain += 1;
        logger.error(`Email was accepted but delivery state could not be finalized: ${recordError.message}`);
      }
    } catch (error) {
      summary.failed += 1;
      await recordDelivery(supabase, {
        campaign_id: campaignId,
        email: recipient.email,
        status: 'failed',
        attempts,
        message_id: null,
        last_error: String(error.message || error).slice(0, 500),
        sent_at: null,
        updated_at: new Date().toISOString(),
      }).catch(recordError => logger.error(`Could not record failure: ${recordError.message}`));
      logger.error(`Failed reopening email for ${maskEmail(recipient.email)}: ${error.message}`);
    }

    if (index < contacts.length - 1) await delay(delayMs);
  }

  return summary;
}
