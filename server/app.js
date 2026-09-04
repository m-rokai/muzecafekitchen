import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import { checkDatabaseIntegrity } from './db/database.js';
import { processPickupReminders } from './services/pickupReminder.js';
import { importPartnerMenu } from './services/partnerMenuImport.js';
import { isEmailConfigured } from './services/email.js';
import { paymentActivationStatus } from './services/payments.js';

function configuredCorsOrigins() {
  const values = [process.env.CLIENT_URL, process.env.CORS_ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap(value => String(value).split(','));
  const origins = new Set();
  for (const value of values) {
    const origin = value.trim().replace(/\/$/, '');
    if (!origin) continue;
    try {
      const parsed = new URL(origin);
      if (['http:', 'https:'].includes(parsed.protocol)
        && !parsed.username && !parsed.password
        && parsed.pathname === '/' && !parsed.search && !parsed.hash) {
        origins.add(origin);
      }
    } catch {
      // Invalid configuration is ignored and never broadens CORS access.
    }
  }
  return origins;
}

const allowedCorsOrigins = configuredCorsOrigins();
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.has(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
// Payment providers sign the exact request bytes, so webhook routes must run
// before the general JSON parser mutates the body.
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));

app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', async (req, res) => {
  try {
    const database = await checkDatabaseIntegrity();
    res.json({
      status: 'ok',
      database,
      features: {
        email: { configured: isEmailConfigured() },
        payments: paymentActivationStatus(),
        partnerMenuImport: { configured: Boolean(process.env.PARTNER_MENU_URL?.trim()) },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ status: 'unavailable', database: 'error' });
  }
});

app.get('/api/cron/pickup-reminders', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('Authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    return res.json(await processPickupReminders());
  } catch (error) {
    console.error('Pickup reminder cron failed:', error);
    return res.status(500).json({ message: 'Pickup reminder processing failed' });
  }
});

app.get('/api/cron/partner-menu', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('Authorization') !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    return res.json(await importPartnerMenu());
  } catch (error) {
    console.error('Partner menu import failed:', error);
    return res.status(500).json({ message: 'Partner menu import failed' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled request error:', error);
  const status = error.status || (error.name === 'MulterError' ? 400 : 500);
  return res.status(status).json({
    message: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message || 'Internal server error',
  });
});

export default app;
