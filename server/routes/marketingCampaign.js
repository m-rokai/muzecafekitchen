import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { runReopeningCampaign } from '../services/reopeningCampaign.js';

const router = express.Router();
const campaignRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

function safeEqual(left, right) {
  const first = Buffer.from(String(left || ''));
  const second = Buffer.from(String(right || ''));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function isAuthorized(req) {
  const secret = process.env.CAMPAIGN_TRIGGER_SECRET;
  const authorization = req.get('Authorization') || '';
  return Boolean(secret) && safeEqual(authorization, `Bearer ${secret}`);
}

router.post('/reopening', campaignRateLimit, async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ message: 'Unauthorized' });
  const mode = req.body?.mode;
  if (!['test', 'campaign'].includes(mode)) {
    return res.status(400).json({ message: 'Mode must be test or campaign' });
  }

  try {
    const summary = await runReopeningCampaign({ mode });
    return res.status(summary.failed ? 502 : 200).json(summary);
  } catch (error) {
    console.error('Reopening campaign failed:', error);
    return res.status(500).json({ message: 'Campaign processing failed' });
  }
});

export { isAuthorized, safeEqual };
export default router;

