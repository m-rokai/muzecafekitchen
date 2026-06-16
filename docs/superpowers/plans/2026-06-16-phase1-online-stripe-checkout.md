# Phase 1: Online Stripe Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real card payment to online ordering via Stripe-hosted Checkout, so an online order only reaches the kitchen after it's paid.

**Architecture:** A shared, channel-aware Stripe "PaymentIntent core" on the Express backend. Online order creation now produces an **unpaid** order; the client redirects to a Stripe Checkout Session; a signature-verified webhook is the single source of truth that marks the order paid, emits it to the kitchen, and sends the confirmation email. This same core is reused by the kiosk in Phase 2.

**Tech Stack:** Node/Express (ESM), better-sqlite3, `stripe` Node SDK, Stripe Checkout (hosted), Stripe CLI for local webhook testing, `node:test` for unit tests, React + Vite client.

**Scope:** This plan is **Phase 1 only** (see `docs/superpowers/specs/2026-06-15-muze-cafe-kiosk-design.md`). Kiosk/Terminal, catalog, and lockdown are later phases with their own plans.

---

## Behavioral cutover (read first)

Today `POST /api/orders` immediately emits the order to the kitchen and emails a confirmation, with "pay at pickup." After Phase 1, online orders are created **unpaid** and do **not** reach the kitchen until Stripe confirms payment. The kitchen emit + confirmation email move into the webhook. Legacy orders are backfilled to `paid` so history/stats are unaffected. **Do not deploy to production until the webhook is verified end-to-end (Task 10).**

## File Structure

**New files:**
- `server/lib/stripe.js` — lazy singleton Stripe client (`getStripe()`).
- `server/services/payments.js` — pure helpers (`dollarsToCents`, `buildCheckoutLineItems`) + `createCheckoutSessionForOrder`.
- `server/routes/payments.js` — `POST /api/payments/checkout-session`.
- `server/routes/stripeWebhook.js` — `POST /api/stripe/webhook` (raw body).
- `server/services/payments.test.js` — unit tests for pure helpers + session builder.
- `server/db/payments.test.js` — unit tests for `markOrderPaid` idempotency.

**Modified files:**
- `server/package.json` — add `stripe` dep + `test` script.
- `server/.env.example` — add Stripe + URL vars.
- `server/db/schema.sql` — new `orders` payment columns + `payments` table (fresh installs).
- `server/db/database.js` — ALTER migration for existing DBs, `markOrderPaid`, gate kitchen/revenue queries on `payment_status='paid'`.
- `server/index.js` — mount webhook (raw) before `express.json()`; mount payments router after.
- `server/routes/orders.js` — stop emitting/emailing at creation (now webhook-driven).
- `client/src/utils/api.js` — add `paymentsAPI`.
- `client/src/pages/CheckoutPage.jsx` — redirect to Stripe Checkout.
- `client/src/pages/ConfirmationPage.jsx` — handle paid return.

---

## Task 1: Stripe dependency, lazy client, env, test runner

**Files:**
- Modify: `server/package.json`
- Create: `server/lib/stripe.js`
- Modify: `server/.env.example`

- [ ] **Step 1: Install the Stripe SDK**

Run:
```bash
cd server && npm install stripe
```
Expected: `stripe` appears under `dependencies` in `server/package.json`.

- [ ] **Step 2: Add a test script**

In `server/package.json`, edit the `"scripts"` block to add a `test` script:
```json
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js",
    "test": "node --test"
  },
```

- [ ] **Step 3: Create the lazy Stripe client**

Create `server/lib/stripe.js`:
```js
import Stripe from 'stripe';

// Lazy singleton so importing payment code in tests (or before env is set)
// never requires STRIPE_SECRET_KEY. The client is built on first real use.
let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  _stripe = new Stripe(key);
  return _stripe;
}
```

- [ ] **Step 4: Document the new env vars**

Append to `server/.env.example`:
```bash

# Stripe (test keys for dev, live keys via `fly secrets set` in prod)
STRIPE_SECRET_KEY=sk_test_xxx
# Webhook signing secret from `stripe listen` (dev) or the Stripe Dashboard (prod)
STRIPE_WEBHOOK_SECRET=whsec_xxx
# Absolute base URL used to build Checkout success/cancel URLs when the
# request Origin header is unavailable (e.g. server-to-server). Optional in dev.
PUBLIC_URL=http://localhost:5173
```

- [ ] **Step 5: Verify the test runner works (no tests yet)**

Run:
```bash
cd server && npm test
```
Expected: exits 0 with "tests 0" (node:test finds no test files yet).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/lib/stripe.js server/.env.example
git commit -m "feat(payments): add Stripe SDK, lazy client, env, test runner"
```

---

## Task 2: Payments service pure helpers (TDD)

**Files:**
- Create: `server/services/payments.js`
- Test: `server/services/payments.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/services/payments.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dollarsToCents, buildCheckoutLineItems } from './payments.js';

test('dollarsToCents converts dollars to integer cents', () => {
  assert.equal(dollarsToCents(10.5), 1050);
  assert.equal(dollarsToCents(0.07), 7);
  assert.equal(dollarsToCents(12.34), 1234);
  assert.equal(dollarsToCents(0), 0);
});

test('buildCheckoutLineItems charges the exact order total as one line', () => {
  const order = { id: 7, pickup_number: 42, total: 10.5 };
  const items = buildCheckoutLineItems(order);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 1);
  assert.equal(items[0].price_data.currency, 'usd');
  assert.equal(items[0].price_data.unit_amount, 1050);
  assert.match(items[0].price_data.product_data.name, /Order #42/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd server && node --test services/payments.test.js
```
Expected: FAIL — cannot find module `./payments.js` (or export missing).

- [ ] **Step 3: Write minimal implementation**

Create `server/services/payments.js`:
```js
import { getStripe } from '../lib/stripe.js';

// Convert a dollar amount (REAL in the DB) to integer cents for Stripe.
export function dollarsToCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

// One line item for the exact order total (tax included). Charging a single
// line equal to order.total guarantees the captured amount matches our trusted
// server-side total with no rounding/tax drift. Itemization is shown in our UI.
export function buildCheckoutLineItems(order) {
  return [
    {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(order.total),
        product_data: {
          name: `Muze Café — Order #${order.pickup_number}`,
        },
      },
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd server && node --test services/payments.test.js
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/services/payments.js server/services/payments.test.js
git commit -m "feat(payments): line-item builder + dollars-to-cents (TDD)"
```

---

## Task 3: DB payment columns, payments table, idempotent markOrderPaid (TDD)

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/db/database.js`
- Test: `server/db/payments.test.js`

- [ ] **Step 1: Write the failing test**

Create `server/db/payments.test.js`:
```js
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the DB module at a throwaway file BEFORE importing it.
const tmpDb = path.join(os.tmpdir(), `muze-pay-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = tmpDb;
const db = await import('./database.js');

after(() => {
  for (const ext of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + ext); } catch { /* ignore */ }
  }
});

test('new orders are unpaid and excluded from the kitchen queue', () => {
  const { id } = db.createOrder({ customer_name: 'Test', email: null, subtotal: 10, tax: 0.82, total: 10.82, notes: null });
  const order = db.getOrder(id);
  assert.equal(order.payment_status, 'unpaid');
  const active = db.getActiveOrders().map(o => o.id);
  assert.ok(!active.includes(id), 'unpaid order must not appear in the kitchen queue');
});

test('markOrderPaid is idempotent and records one payment', () => {
  const { id } = db.createOrder({ customer_name: 'Pay', email: null, subtotal: 5, tax: 0.41, total: 5.41, notes: null });

  const first = db.markOrderPaid(id, { sessionId: 'cs_1', paymentIntentId: 'pi_1', amountCents: 541 });
  assert.equal(first.alreadyPaid, false);
  assert.equal(first.order.payment_status, 'paid');

  const second = db.markOrderPaid(id, { sessionId: 'cs_1', paymentIntentId: 'pi_1', amountCents: 541 });
  assert.equal(second.alreadyPaid, true);

  const paid = db.getActiveOrders().map(o => o.id);
  assert.ok(paid.includes(id), 'paid order must appear in the kitchen queue');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd server && node --test db/payments.test.js
```
Expected: FAIL — `db.markOrderPaid is not a function` / `payment_status` undefined.

- [ ] **Step 3: Add the new columns + payments table to `schema.sql` (fresh installs)**

In `server/db/schema.sql`, replace the `orders` table's closing lines. Change:
```sql
  pickup_reminder_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
to:
```sql
  pickup_reminder_sent INTEGER DEFAULT 0,
  channel TEXT DEFAULT 'online',
  payment_status TEXT DEFAULT 'unpaid',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Payments ledger (one row per successful charge; shared by online + kiosk)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'online',
  amount_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'paid',
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

- [ ] **Step 4: Add the ALTER migration for existing DBs**

In `server/db/database.js`, after the existing "cancellation + pickup-reminder columns" migration block (ends ~line 86), add:
```js
// Migration: Add payment columns to orders + payments table (Phase 1 Stripe).
// Existing rows are legacy "pay at pickup" orders → backfill as 'paid' so
// kitchen/revenue queries are unaffected. New rows default to 'unpaid'.
try {
  const columns = db.prepare('PRAGMA table_info(orders)').all();
  const colNames = new Set(columns.map(col => col.name));
  if (!colNames.has('channel')) {
    db.prepare("ALTER TABLE orders ADD COLUMN channel TEXT DEFAULT 'online'").run();
  }
  if (!colNames.has('payment_status')) {
    db.prepare("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'").run();
    db.prepare("UPDATE orders SET payment_status = 'paid'").run(); // backfill legacy orders
    console.log('Migration: Added payment_status to orders (legacy rows backfilled paid)');
  }
  if (!colNames.has('stripe_session_id')) {
    db.prepare('ALTER TABLE orders ADD COLUMN stripe_session_id TEXT').run();
  }
  if (!colNames.has('stripe_payment_intent_id')) {
    db.prepare('ALTER TABLE orders ADD COLUMN stripe_payment_intent_id TEXT').run();
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      channel TEXT NOT NULL DEFAULT 'online',
      amount_cents INTEGER,
      currency TEXT DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'paid',
      stripe_session_id TEXT,
      stripe_payment_intent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);
} catch (err) {
  console.error('Migration error (payments columns):', err);
}
```

- [ ] **Step 5: Add `markOrderPaid` to `database.js`**

In `server/db/database.js`, in the `// ============ Orders ============` section (e.g. right after `createOrder`, ~line 578), add:
```js
// Idempotently mark an order paid and append a payments-ledger row. Returns
// { alreadyPaid, order }. If the order is already paid, no second ledger row
// is written (safe against Stripe webhook retries / duplicate deliveries).
export function markOrderPaid(orderId, { sessionId = null, paymentIntentId = null, amountCents = null } = {}) {
  const run = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!existing) return { alreadyPaid: false, notFound: true, order: null };
    if (existing.payment_status === 'paid') {
      return { alreadyPaid: true, order: getOrder(orderId) };
    }
    db.prepare(`
      UPDATE orders
      SET payment_status = 'paid',
          stripe_session_id = ?,
          stripe_payment_intent_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(sessionId, paymentIntentId, orderId);
    db.prepare(`
      INSERT INTO payments (order_id, channel, amount_cents, currency, status, stripe_session_id, stripe_payment_intent_id)
      VALUES (?, 'online', ?, 'usd', 'paid', ?, ?)
    `).run(orderId, amountCents, sessionId, paymentIntentId);
    return { alreadyPaid: false, order: getOrder(orderId) };
  });
  return run();
}
```

- [ ] **Step 6: Gate the kitchen + revenue queries on `payment_status='paid'`**

In `server/db/database.js`, in `getActiveOrders`, change the WHERE clause:
```sql
    WHERE status IN ('pending', 'preparing', 'ready')
```
to:
```sql
    WHERE status IN ('pending', 'preparing', 'ready')
      AND payment_status = 'paid'
```

In `getTodayRevenue`, change:
```sql
    WHERE date(created_at) = date('now') AND status != 'cancelled'
```
to:
```sql
    WHERE date(created_at) = date('now') AND status != 'cancelled' AND payment_status = 'paid'
```

In `getOrderStats`, change the `total_revenue` line:
```sql
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) as total_revenue,
```
to:
```sql
      COALESCE(SUM(CASE WHEN status != 'cancelled' AND payment_status = 'paid' THEN total ELSE 0 END), 0) as total_revenue,
```

- [ ] **Step 7: Run test to verify it passes**

Run:
```bash
cd server && node --test db/payments.test.js
```
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add server/db/schema.sql server/db/database.js server/db/payments.test.js
git commit -m "feat(payments): payment columns, payments ledger, idempotent markOrderPaid (TDD)"
```

---

## Task 4: createCheckoutSessionForOrder (TDD with injected Stripe)

**Files:**
- Modify: `server/services/payments.js`
- Modify: `server/services/payments.test.js`

- [ ] **Step 1: Write the failing test**

Append to `server/services/payments.test.js`:
```js
test('createCheckoutSessionForOrder builds a payment-mode session for the order', async () => {
  const { createCheckoutSessionForOrder } = await import('./payments.js');
  const calls = [];
  const fakeStripe = {
    checkout: { sessions: { create: async (params) => { calls.push(params); return { id: 'cs_test_123', url: 'https://stripe.test/cs_test_123' }; } } },
  };
  const order = { id: 7, pickup_number: 42, total: 10.5, email: 'a@b.com' };

  const session = await createCheckoutSessionForOrder(order, { stripe: fakeStripe, origin: 'https://shop.test' });

  assert.equal(session.url, 'https://stripe.test/cs_test_123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'payment');
  assert.equal(calls[0].success_url, 'https://shop.test/confirmation/7?paid=1');
  assert.equal(calls[0].cancel_url, 'https://shop.test/checkout');
  assert.equal(calls[0].client_reference_id, '7');
  assert.equal(calls[0].customer_email, 'a@b.com');
  assert.equal(calls[0].metadata.order_id, '7');
  assert.equal(calls[0].metadata.channel, 'online');
  assert.equal(calls[0].line_items[0].price_data.unit_amount, 1050);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd server && node --test services/payments.test.js
```
Expected: FAIL — `createCheckoutSessionForOrder` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `server/services/payments.js`:
```js
// Create a Stripe-hosted Checkout Session for an order. `stripe` is injectable
// for tests; `origin` is the absolute base URL for success/cancel redirects.
export async function createCheckoutSessionForOrder(order, { stripe = getStripe(), origin } = {}) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: buildCheckoutLineItems(order),
    success_url: `${origin}/confirmation/${order.id}?paid=1`,
    cancel_url: `${origin}/checkout`,
    client_reference_id: String(order.id),
    customer_email: order.email || undefined,
    metadata: { order_id: String(order.id), channel: 'online' },
    payment_intent_data: { metadata: { order_id: String(order.id), channel: 'online' } },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd server && npm test
```
Expected: PASS — all payments service tests (3) + db tests (2).

- [ ] **Step 5: Commit**

```bash
git add server/services/payments.js server/services/payments.test.js
git commit -m "feat(payments): createCheckoutSessionForOrder (TDD, injected stripe)"
```

---

## Task 5: Checkout-session route + mount

**Files:**
- Create: `server/routes/payments.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create the route**

Create `server/routes/payments.js`:
```js
import express from 'express';
import * as db from '../db/database.js';
import { createCheckoutSessionForOrder } from '../services/payments.js';

const router = express.Router();

// Create a Stripe Checkout Session for an existing unpaid order.
router.post('/checkout-session', async (req, res) => {
  try {
    const orderId = parseInt(req.body?.orderId, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: 'Invalid orderId' });
    }

    const order = db.getOrder(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.payment_status === 'paid') {
      return res.status(409).json({ message: 'Order is already paid' });
    }

    const origin = req.headers.origin || process.env.PUBLIC_URL || 'http://localhost:5173';
    const session = await createCheckoutSessionForOrder(order, { origin });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ message: 'Failed to start checkout' });
  }
});

export default router;
```

- [ ] **Step 2: Import and mount it (after `express.json()`)**

In `server/index.js`, add to the route imports (~line 12):
```js
import paymentRoutes from './routes/payments.js';
```
And in the `// API Routes` block (~line 92), add after the admin route:
```js
app.use('/api/payments', paymentRoutes);
```

- [ ] **Step 3: Verify the server boots**

Run:
```bash
cd server && STRIPE_SECRET_KEY=sk_test_dummy node -e "import('./index.js').then(()=>{console.log('boot ok');process.exit(0)})"
```
Expected: prints "Server running..." and "boot ok" with no import errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/payments.js server/index.js
git commit -m "feat(payments): POST /api/payments/checkout-session route"
```

---

## Task 6: Stripe webhook route + raw-body mount + finalize

**Files:**
- Create: `server/routes/stripeWebhook.js`
- Modify: `server/index.js`

- [ ] **Step 1: Create the webhook route**

Create `server/routes/stripeWebhook.js`:
```js
import express from 'express';
import * as db from '../db/database.js';
import { getStripe } from '../lib/stripe.js';
import { sendOrderConfirmation } from '../services/email.js';

const router = express.Router();

// Stripe webhook. Mounted with express.raw so req.body is the raw Buffer
// required for signature verification. This is the SOURCE OF TRUTH for "paid".
router.post('/', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = parseInt(session.metadata?.order_id || session.client_reference_id, 10);
      if (Number.isInteger(orderId)) {
        const result = db.markOrderPaid(orderId, {
          sessionId: session.id,
          paymentIntentId: session.payment_intent || null,
          amountCents: session.amount_total ?? null,
        });

        // Finalize only on the first transition to paid (idempotent).
        if (result.order && !result.alreadyPaid) {
          const io = req.app.get('io');
          if (io) io.emit('new-order', result.order);
          if (result.order.email) {
            sendOrderConfirmation(result.order).catch(e => console.error('Confirmation email failed:', e));
          }
        }
      }
    }
  } catch (err) {
    console.error('Error handling webhook event:', err);
    // Still return 200 so Stripe doesn't retry a non-recoverable handler error.
  }

  return res.json({ received: true });
});

export default router;
```

- [ ] **Step 2: Mount it with raw body BEFORE `express.json()`**

In `server/index.js`, add to the route imports (~line 12):
```js
import stripeWebhookRoutes from './routes/stripeWebhook.js';
```
Then, **immediately before** the line `app.use(express.json());` (~line 78), add:
```js
// Stripe webhook needs the raw body for signature verification — must be
// registered BEFORE express.json() or verification fails silently.
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRoutes);
```

- [ ] **Step 3: Verify the server still boots**

Run:
```bash
cd server && STRIPE_SECRET_KEY=sk_test_dummy node -e "import('./index.js').then(()=>{console.log('boot ok');process.exit(0)})"
```
Expected: "boot ok" with no errors.

- [ ] **Step 4: Commit**

```bash
git add server/routes/stripeWebhook.js server/index.js
git commit -m "feat(payments): Stripe webhook (raw body) finalizes paid orders"
```

---

## Task 7: Order-creation cutover (no kitchen emit / email until paid)

**Files:**
- Modify: `server/routes/orders.js`

- [ ] **Step 1: Remove the immediate kitchen emit + confirmation email**

In `server/routes/orders.js`, in the `POST '/'` handler, delete this block (currently ~lines 147–161):
```js
    // Emit to kitchen display
    const io = req.app.get('io');
    if (io) {
      console.log('📤 Emitting new-order to kitchen:', order.id, order.customer_name);
      io.emit('new-order', order);
    } else {
      console.log('⚠️ Socket.io not available');
    }

    // Send confirmation email (async, don't block response)
    if (order.email) {
      sendOrderConfirmation(order).catch(err => {
        console.error('Failed to send confirmation email:', err);
      });
    }
```
Replace it with:
```js
    // NOTE: kitchen emit + confirmation email now happen in the Stripe webhook
    // once payment is confirmed (see routes/stripeWebhook.js). Orders are
    // created unpaid and must be paid via Checkout before reaching the kitchen.
```

- [ ] **Step 2: Drop the now-unused import**

In `server/routes/orders.js` line 7, remove `sendOrderConfirmation` from the import (keep the others):
```js
import { sendOrderReadyNotification, sendOrderCancellation } from '../services/email.js';
```

- [ ] **Step 3: Verify the server boots**

Run:
```bash
cd server && STRIPE_SECRET_KEY=sk_test_dummy node -e "import('./index.js').then(()=>{console.log('boot ok');process.exit(0)})"
```
Expected: "boot ok" (no "sendOrderConfirmation is not defined").

- [ ] **Step 4: Commit**

```bash
git add server/routes/orders.js
git commit -m "feat(payments): online orders created unpaid; finalize moved to webhook"
```

---

## Task 8: Client — paymentsAPI + redirect to Checkout

**Files:**
- Modify: `client/src/utils/api.js`
- Modify: `client/src/pages/CheckoutPage.jsx`

- [ ] **Step 1: Add the payments API helper**

In `client/src/utils/api.js`, after the `orderAPI` block (before `settingsAPI`, ~line 144), add:
```js
// ============ Payments endpoints ============
export const paymentsAPI = {
  // Returns { url } — the Stripe Checkout URL to redirect to.
  createCheckoutSession: (orderId) => request('/payments/checkout-session', {
    method: 'POST',
    body: { orderId },
  }),
};
```
And update the default export at the bottom of the file:
```js
export default { menuAPI, orderAPI, adminAPI, settingsAPI, paymentsAPI };
```

- [ ] **Step 2: Redirect to Stripe in CheckoutPage**

In `client/src/pages/CheckoutPage.jsx`, update the import on line 5:
```js
import { orderAPI, paymentsAPI, settingsAPI } from '../utils/api';
```

Then replace the `try { ... } catch` body of `handleSubmit` (currently ~lines 49–86, from `const orderData = {` through the end of the `catch`) with:
```js
    try {
      const orderData = {
        customerName: name.trim(),
        email: email.trim() || null,
        subtotal: cartTotal,
        tax,
        total,
        items: items.map(item => ({
          menu_item_id: item.id,
          item_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: getItemTotal(item),
          special_instructions: item.specialInstructions || null,
          modifiers: item.modifiers?.map(mod => ({
            modifier_name: mod.display_name || mod.name,
            price_adjustment: mod.price_adjustment || 0,
          })) || [],
        })),
      };

      const result = await orderAPI.create(orderData);
      orderSubmittedRef.current = true;
      setCustomerName(name.trim());
      if (email.trim()) localStorage.setItem('muze_customer_email', email.trim());

      // Hand off to Stripe-hosted Checkout. The cart is cleared on the
      // confirmation page only after payment succeeds (cancel returns here
      // with the cart intact). Payment success → webhook → kitchen + email.
      const { url } = await paymentsAPI.createCheckoutSession(result.id);
      window.location.href = url;
    } catch (err) {
      console.error('Checkout failed:', err);
      setError(err.message || 'Failed to start checkout. Please try again.');
      orderSubmittedRef.current = false;
      setLoading(false);
    }
```
(Note: the `finally { setLoading(false); }` is removed — on success we navigate away, so loading should persist through the redirect.)

- [ ] **Step 3: Update the payment banner + button copy**

In `client/src/pages/CheckoutPage.jsx`, replace the "Pay at pickup" banner (~lines 207–212):
```jsx
          {/* Pay at pickup */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
            <p className="text-amber-900 text-sm text-center">
              <strong>Pay at pickup.</strong> You'll settle up when you grab your order at Muze Office.
            </p>
          </div>
```
with:
```jsx
          {/* Card payment */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-5">
            <p className="text-amber-900 text-sm text-center">
              <strong>Secure card payment.</strong> You'll pay by card on the next step. We start your order once payment is confirmed.
            </p>
          </div>
```
And change the button's final label (~line 236):
```jsx
            <>Place Order · {formatPriceFromDollars(total)}</>
```
to:
```jsx
            <>Continue to Payment · {formatPriceFromDollars(total)}</>
```
And the loading label (~line 232):
```jsx
            <><Loader2 className="w-5 h-5 animate-spin" /> Placing Order…</>
```
to:
```jsx
            <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to payment…</>
```

- [ ] **Step 4: Verify the client builds**

Run:
```bash
cd client && npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/utils/api.js client/src/pages/CheckoutPage.jsx
git commit -m "feat(payments): client redirects to Stripe Checkout"
```

---

## Task 9: Client — confirmation page handles paid return

**Files:**
- Modify: `client/src/pages/ConfirmationPage.jsx`

- [ ] **Step 1: Import cart + search params**

In `client/src/pages/ConfirmationPage.jsx`, update line 2:
```js
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
```
Add after the existing `import` for GlassPanel (~line 8):
```js
import { useCart } from '../context/CartContext';
```

- [ ] **Step 2: Wire the hooks and the paid effect**

In the component body, after `const navigate = useNavigate();` (~line 16), add:
```js
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const paidReturn = searchParams.get('paid') === '1';
  const finalizedRef = useRef(false);
```

Then add this effect after the existing socket `useEffect` (after its closing `}, [orderId]);`, ~line 74):
```js
  // On a successful Stripe return, clear the cart once and remember the order
  // so the menu's active-order banner can show it. Runs after the order loads.
  useEffect(() => {
    if (!paidReturn || !order || finalizedRef.current) return;
    finalizedRef.current = true;
    clearCart();
    localStorage.setItem('muze_last_order', JSON.stringify({
      orderId: order.id,
      pickupNumber: order.pickup_number,
      timestamp: Date.now(),
    }));
  }, [paidReturn, order, clearCart]);
```

- [ ] **Step 3: Update the total label to reflect payment**

In `client/src/pages/ConfirmationPage.jsx`, replace the total row (~lines 222–225):
```jsx
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-muze-gold/20">
              <span className="text-muze-dark">Total · Pay at pickup</span>
              <span className="text-muze-brown">{formatPriceFromDollars(order.total)}</span>
            </div>
```
with:
```jsx
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-muze-gold/20">
              <span className="text-muze-dark">Total{(paidReturn || order.payment_status === 'paid') ? ' · Paid' : ''}</span>
              <span className="text-muze-brown">{formatPriceFromDollars(order.total)}</span>
            </div>
```

- [ ] **Step 4: Verify the client builds**

Run:
```bash
cd client && npm run build
```
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/ConfirmationPage.jsx
git commit -m "feat(payments): confirmation page clears cart + shows Paid on success"
```

---

## Task 10: End-to-end verification with Stripe test mode

**Files:** none (manual integration test). Requires the **Stripe CLI** (`brew install stripe/stripe-cli/stripe`) and a Stripe **test** secret key.

- [ ] **Step 1: Start the backend with a test key**

In one terminal:
```bash
cd server && STRIPE_SECRET_KEY=sk_test_xxx PUBLIC_URL=http://localhost:5173 npm run dev
```

- [ ] **Step 2: Forward webhooks and capture the signing secret**

In a second terminal:
```bash
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
```
Copy the `whsec_...` it prints, then restart the server (Step 1) with `STRIPE_WEBHOOK_SECRET=whsec_...` added.

- [ ] **Step 3: Start the client**

In a third terminal:
```bash
cd client && npm run dev
```

- [ ] **Step 4: Place a test order**

In the browser at `http://localhost:5173`: add an item → cart → checkout → enter name + email → "Continue to Payment". On the Stripe page use test card `4242 4242 4242 4242`, any future expiry, any CVC/ZIP.

Expected:
- `stripe listen` shows `checkout.session.completed` → your endpoint returns `200`.
- Redirect lands on `/confirmation/<id>?paid=1` showing **Total · Paid**.
- The server log shows `new-order` emitted; an open `/kitchen` tab (logged in) receives the order.
- Confirmation email is sent (if GMAIL_* configured) — otherwise the log shows the attempt.

- [ ] **Step 5: Verify the unpaid path is hidden from the kitchen**

Place another order but **cancel** on the Stripe page. Expected: you return to `/checkout` (cart intact); the order exists but never appears in `/kitchen` (it stays `payment_status='unpaid'`).

- [ ] **Step 6: Run the full unit suite + client build once more**

```bash
cd server && npm test && cd ../client && npm run build
```
Expected: all server tests pass; client build succeeds.

---

## Task 11: Production rollout (requires founder action — do NOT run unilaterally)

**Files:** none (deploy + Stripe Dashboard config).

> ⚠️ This task uses **live** Stripe keys and changes customer-facing payment behavior. Confirm with the founder before running. Pushing to `main` auto-deploys (Fly CI).

- [ ] **Step 1: Create the production webhook endpoint in Stripe**

In the Stripe Dashboard (live mode) → Developers → Webhooks → Add endpoint:
- URL: `https://muzecafe-kitchen.fly.dev/api/stripe/webhook` (or the custom domain)
- Event: `checkout.session.completed`
- Copy the signing secret (`whsec_...`).

- [ ] **Step 2: Set Fly secrets (live)**

```bash
fly secrets set \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_live_xxx \
  PUBLIC_URL=https://muzecafe-kitchen.fly.dev \
  --app muzecafe-kitchen
```

- [ ] **Step 3: Keep one machine warm for webhook delivery**

```bash
fly scale count 1 --app muzecafe-kitchen
```
(Confirms `min_machines_running` ≥ 1 so webhooks aren't missed on cold start; Stripe retries, but this reduces latency.)

- [ ] **Step 4: Merge to main and verify the live deploy**

```bash
git checkout main && git merge --no-ff kiosk-rework && git push origin main
gh run watch --exit-status
```

- [ ] **Step 5: Smoke-test live with a real card (small amount) and refund it**

Place one real order, confirm it reaches the kitchen, then refund it from the Stripe Dashboard. Verify `/kitchen` and the confirmation page behaved correctly.

---

## Self-Review

**Spec coverage (Phase 1 items):** ✅ `stripe` dep + `lib/stripe.js` (Task 1); ✅ channel-aware `createPaymentIntent`-equivalent core via `createCheckoutSessionForOrder` from the trusted order row + `metadata` (Tasks 2,4); ✅ online returns a Checkout URL + redirect (Tasks 5,8); ✅ webhook with `express.raw` before global `express.json()` (Task 6); ✅ idempotency via idempotent `markOrderPaid` (Task 3); ✅ `payments` table + `payment_status`/`payment_intent_id` columns (Task 3); ✅ test mode + `stripe listen` (Task 10); ✅ `fly secrets` + `min_machines_running` (Task 11). Capture mode is automatic (Checkout default) per the spec. Receipts: handled by Stripe (email entered at Checkout) — no custom code needed in Phase 1.

**Placeholder scan:** No TBD/TODO; every code/command step is concrete.

**Type/name consistency:** `getStripe()`, `dollarsToCents()`, `buildCheckoutLineItems(order)`, `createCheckoutSessionForOrder(order, { stripe, origin })`, `markOrderPaid(orderId, { sessionId, paymentIntentId, amountCents })` → `{ alreadyPaid, order }`, `paymentsAPI.createCheckoutSession(orderId)` → `{ url }`, route `POST /api/payments/checkout-session` body `{ orderId }`, webhook `POST /api/stripe/webhook`. Names are used identically across tasks.
