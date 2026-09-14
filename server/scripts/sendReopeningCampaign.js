#!/usr/bin/env node
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { getSupabaseAdminClient } from '../lib/supabase.js';
import {
  buildUnsubscribeMailto,
  buildUnsubscribeUrl,
  maskEmail,
  normalizeEmail,
  parseCampaignRecipients,
  recipientHash,
  renderCampaignEmail,
} from '../services/marketingCampaign.js';

const EXPECTED_SENDER = 'notifications@muzeoffice.com';
const DEFAULT_SUBJECT = 'We’re back at Muze ☕ Meet the new café menu';
const DEFAULT_CAMPAIGN_ID = 'muze-reopening-2026';
const DEFAULT_DELAY_MS = 1500;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultTemplatePath = path.resolve(scriptDirectory, '../emails/reopening-marketing.html');

function usage() {
  console.log(`
Send the Muze reopening campaign through notifications@muzeoffice.com.

Dry run (default):
  npm run campaign:reopening -- --recipients /path/to/customer-emails.csv

Send one test message:
  npm run campaign:reopening -- --test-to you@example.com --send

Send the campaign:
  npm run campaign:reopening -- --recipients /path/to/customer-emails.csv --send

Options:
  --recipients <path>   CSV with an "email" column
  --test-to <email>     Send only to one test address
  --template <path>     Override the included visual HTML template
  --subject <text>      Override the subject line
  --campaign-id <id>    Change the resume-log campaign identifier
  --delay-ms <number>   Delay between messages (default: ${DEFAULT_DELAY_MS})
  --send                Actually deliver messages; otherwise this is a dry run
  --help                Show this help

Required environment variables for --send:
  GMAIL_USER=${EXPECTED_SENDER}
  GMAIL_APP_PASSWORD=<Google app password>
  CAMPAIGN_BUSINESS_MAILING_ADDRESS=<physical business address>

Optional:
  GMAIL_FROM_NAME=Cuss Worthy Café at Muze
  CAMPAIGN_UNSUBSCRIBE_EMAIL=${EXPECTED_SENDER}
`);
}

function parseArgs(argv) {
  const args = {
    campaignId: DEFAULT_CAMPAIGN_ID,
    delayMs: DEFAULT_DELAY_MS,
    send: false,
    subject: DEFAULT_SUBJECT,
    templatePath: defaultTemplatePath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--send') args.send = true;
    else if (argument === '--help') args.help = true;
    else if (argument === '--recipients') args.recipientsPath = argv[++index];
    else if (argument === '--test-to') args.testTo = argv[++index];
    else if (argument === '--template') args.templatePath = argv[++index];
    else if (argument === '--subject') args.subject = argv[++index];
    else if (argument === '--campaign-id') args.campaignId = argv[++index];
    else if (argument === '--delay-ms') args.delayMs = Number(argv[++index]);
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (!Number.isInteger(args.delayMs) || args.delayMs < 1000) {
    throw new Error('--delay-ms must be an integer of at least 1000.');
  }
  if (!args.testTo && !args.recipientsPath && !args.help) {
    throw new Error('Provide --recipients or --test-to.');
  }
  if (args.testTo && args.campaignId === DEFAULT_CAMPAIGN_ID) {
    args.campaignId = `${DEFAULT_CAMPAIGN_ID}-test`;
  }
  return args;
}

async function loadRecipients(args) {
  if (args.testTo) {
    const email = normalizeEmail(args.testTo);
    const recipients = parseCampaignRecipients(`email\n${email}\n`);
    return recipients;
  }
  const csvText = await fs.readFile(path.resolve(args.recipientsPath), 'utf8');
  return parseCampaignRecipients(csvText);
}

async function loadSentHashes(logPath) {
  try {
    const content = await fs.readFile(logPath, 'utf8');
    return new Set(content
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line).recipientHash)
      .filter(Boolean));
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

async function prepareCampaignRecipients(supabase, recipients, campaignId) {
  const emails = recipients.map(recipient => recipient.email);
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

async function recordDelivery(supabase, delivery) {
  const { error } = await supabase
    .from('marketing_campaign_deliveries')
    .upsert(delivery, { onConflict: 'campaign_id,email' });
  if (error) throw error;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const recipients = await loadRecipients(args);
  const template = await fs.readFile(path.resolve(args.templatePath), 'utf8');
  const sender = normalizeEmail(process.env.GMAIL_USER || EXPECTED_SENDER);
  const fromName = process.env.GMAIL_FROM_NAME || 'Cuss Worthy Café at Muze';
  const unsubscribeEmail = normalizeEmail(
    process.env.CAMPAIGN_UNSUBSCRIBE_EMAIL || EXPECTED_SENDER,
  );
  const businessMailingAddress = process.env.CAMPAIGN_BUSINESS_MAILING_ADDRESS;
  const publicSiteUrl = (process.env.PUBLIC_SITE_URL || 'https://muzecafe.vercel.app').replace(/\/$/, '');

  console.log(`Campaign: ${args.campaignId}`);
  console.log(`Sender: ${sender}`);
  console.log(`Subject: ${args.subject}`);
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Mode: ${args.send ? 'SEND' : 'DRY RUN'}`);

  if (!args.send) {
    console.log('No email was sent. Add --send only after reviewing the recipient count and template.');
    return;
  }

  if (sender !== EXPECTED_SENDER) {
    throw new Error(`GMAIL_USER must be ${EXPECTED_SENDER} for this campaign.`);
  }
  if (!process.env.GMAIL_APP_PASSWORD) {
    throw new Error('GMAIL_APP_PASSWORD is required for --send.');
  }

  const unsubscribeMailto = buildUnsubscribeMailto(unsubscribeEmail);
  const logPath = path.resolve(
    scriptDirectory,
    '../.campaign-logs',
    `${args.campaignId}.ndjson`,
  );
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const sentHashes = await loadSentHashes(logPath);
  const supabase = getSupabaseAdminClient();
  const contacts = await prepareCampaignRecipients(supabase, recipients, args.campaignId);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: sender,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.verify();
  console.log('Gmail connection verified.');

  let delivered = 0;
  let skipped = 0;
  let suppressed = 0;
  let uncertain = 0;
  const failed = [];

  for (let index = 0; index < contacts.length; index += 1) {
    const recipient = contacts[index];
    const hash = recipientHash(args.campaignId, recipient.email);
    if (recipient.unsubscribed_at) {
      suppressed += 1;
      continue;
    }
    if (sentHashes.has(hash) || recipient.delivery?.status === 'sent') {
      skipped += 1;
      continue;
    }
    if (recipient.delivery?.status === 'pending') {
      uncertain += 1;
      console.warn(`[${index + 1}/${contacts.length}] Skipped an uncertain prior attempt for ${maskEmail(recipient.email)}`);
      continue;
    }

    try {
      const now = new Date().toISOString();
      await recordDelivery(supabase, {
        campaign_id: args.campaignId,
        email: recipient.email,
        status: 'pending',
        attempts: (recipient.delivery?.attempts || 0) + 1,
        message_id: null,
        last_error: null,
        sent_at: null,
        updated_at: now,
      });

      const unsubscribeUrl = buildUnsubscribeUrl(publicSiteUrl, recipient.unsubscribe_token);
      const html = renderCampaignEmail(template, {
        businessMailingAddress,
        unsubscribeUrl,
      });
      const info = await transporter.sendMail({
        from: `"${fromName.replaceAll('"', '')}" <${sender}>`,
        to: recipient.email,
        subject: args.subject,
        html,
        text: [
          'Welcome back! Muze Café is reopening with Cuss Worthy Café.',
          'Browse the refreshed breakfast, lunch, coffee, and matcha menu:',
          'https://muzecafe.vercel.app',
          '',
          `Unsubscribe from marketing emails: ${unsubscribeUrl}`,
          businessMailingAddress,
        ].join('\n'),
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>, <${unsubscribeMailto}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'X-Campaign-ID': args.campaignId,
        },
      });

      await fs.appendFile(logPath, `${JSON.stringify({
        sentAt: new Date().toISOString(),
        recipientHash: hash,
        messageId: info.messageId,
      })}\n`, { mode: 0o600 });
      sentHashes.add(hash);
      await recordDelivery(supabase, {
        campaign_id: args.campaignId,
        email: recipient.email,
        status: 'sent',
        attempts: (recipient.delivery?.attempts || 0) + 1,
        message_id: info.messageId,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      delivered += 1;
      console.log(`[${index + 1}/${contacts.length}] Sent to ${maskEmail(recipient.email)}`);
    } catch (error) {
      await recordDelivery(supabase, {
        campaign_id: args.campaignId,
        email: recipient.email,
        status: sentHashes.has(hash) ? 'sent' : 'failed',
        attempts: (recipient.delivery?.attempts || 0) + 1,
        message_id: null,
        last_error: String(error.message || error).slice(0, 500),
        sent_at: sentHashes.has(hash) ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).catch(recordError => {
        console.error(`Could not record delivery state: ${recordError.message}`);
      });
      failed.push({ recipient: maskEmail(recipient.email), message: error.message });
      console.error(`[${index + 1}/${contacts.length}] Failed for ${maskEmail(recipient.email)}`);
    }

    if (index < contacts.length - 1) await delay(args.delayMs);
  }

  console.log(`Complete: ${delivered} sent, ${skipped} previously sent, ${suppressed} unsubscribed, ${uncertain} uncertain, ${failed.length} failed.`);
  if (uncertain) {
    console.warn('Uncertain prior attempts were not resent to avoid accidental duplicates.');
  }
  if (failed.length) {
    console.error(JSON.stringify(failed, null, 2));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`Campaign stopped: ${error.message}`);
  process.exitCode = 1;
});
