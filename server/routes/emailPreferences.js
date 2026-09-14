import express from 'express';
import rateLimit from 'express-rate-limit';
import { getSupabaseAdminClient } from '../lib/supabase.js';

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const unsubscribeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

function preferencePage({ state = 'confirm', token = '' } = {}) {
  const content = {
    confirm: {
      heading: 'Email preferences',
      message: 'Select the button below to stop receiving marketing emails from Cuss Worthy Café at Muze.',
    },
    confirmed: {
      heading: 'You’re unsubscribed',
      message: 'You will no longer receive marketing emails from Cuss Worthy Café at Muze. Order receipts and service messages are not affected.',
    },
    invalid: {
      heading: 'This link is unavailable',
      message: 'This email-preference link is invalid or has expired. Contact notifications@muzeoffice.com if you need help.',
    },
  }[state] || null;
  if (!content) throw new Error('Unknown preference-page state.');
  const action = state !== 'confirm' ? '' : `
    <form method="post" action="/api/email/unsubscribe?token=${token}">
      <button type="submit">Unsubscribe me</button>
    </form>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <meta name="robots" content="noindex,nofollow">
      <title>${content.heading}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f0e8; color: #2d2014; font-family: Arial, Helvetica, sans-serif; }
        main { width: min(100%, 520px); padding: 42px 34px; border-radius: 20px; background: #fffdf8; text-align: center; box-shadow: 0 12px 36px rgba(45,32,20,.14); }
        .eyebrow { margin: 0 0 12px; color: #a85a32; font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
        h1 { margin: 0; font-size: 34px; line-height: 1.1; }
        p { margin: 18px auto 0; max-width: 410px; color: #765d48; font-size: 16px; line-height: 1.6; }
        button { min-height: 48px; margin-top: 26px; padding: 13px 24px; border: 0; border-radius: 12px; background: #f5b82e; color: #2d2014; font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 6px 16px rgba(168,90,50,.22); }
        a { color: #a85a32; }
      </style>
    </head>
    <body>
      <main>
        <p class="eyebrow">Cuss Worthy Café at Muze</p>
        <h1>${content.heading}</h1>
        <p>${content.message}</p>
        ${action}
        <p><a href="https://muzecafe.vercel.app">Return to the café menu</a></p>
      </main>
    </body>
  </html>`;
}

function tokenFrom(req) {
  const token = String(req.query.token || req.body?.token || '').trim();
  return UUID_PATTERN.test(token) ? token : null;
}

function sendPage(res, status, html) {
  res.set('Cache-Control', 'no-store');
  res.status(status).type('html').send(html);
}

router.get('/unsubscribe', unsubscribeRateLimit, async (req, res) => {
  const token = tokenFrom(req);
  if (!token) return sendPage(res, 400, preferencePage({ state: 'invalid' }));

  const { data, error } = await getSupabaseAdminClient()
    .from('marketing_contacts')
    .select('unsubscribed_at')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return sendPage(res, 404, preferencePage({ state: 'invalid' }));
  if (data.unsubscribed_at) return sendPage(res, 200, preferencePage({ state: 'confirmed' }));
  return sendPage(res, 200, preferencePage({ token }));
});

router.post('/unsubscribe', unsubscribeRateLimit, express.urlencoded({ extended: false }), async (req, res) => {
  const token = tokenFrom(req);
  if (!token) return sendPage(res, 400, preferencePage({ state: 'invalid' }));

  const { data, error } = await getSupabaseAdminClient()
    .from('marketing_contacts')
    .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('unsubscribe_token', token)
    .select('email')
    .maybeSingle();

  if (error) throw error;
  if (!data) return sendPage(res, 404, preferencePage({ state: 'invalid' }));
  return sendPage(res, 200, preferencePage({ state: 'confirmed' }));
});

export { preferencePage, tokenFrom };
export default router;
