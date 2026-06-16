# Muze Café — Grab-and-Go Self-Checkout Kiosk

**Design spec · 2026-06-15 · branch `kiosk-rework`**

## 1. Summary

Rework the Muze Café ordering system into an **unattended grab-and-go self-checkout
kiosk** running in the Muze Office coworking lobby, while **keeping online ordering**
and adding Stripe payments to both. Inspired by Anthropic's Project Vend, but the
**autonomous AI ops agent is explicitly out of scope for now** — we only build the
kiosk and make the data model *ready* for an agent later.

The kiosk is the existing **React + Vite** app wrapped in **Capacitor** as a native
Android app on the Galaxy Tab, driving the café's **Stripe Reader M2** (Bluetooth)
via the first-party Terminal SDK. A new **shared Stripe "PaymentIntent core"** on the
Node/Express backend serves *both* the kiosk (card-present) and online ordering
(Stripe-hosted Checkout). Customers identify packaged items by **barcode scan**
(tablet camera) or tap-to-select, pay, and leave.

## 2. Goals / Non-goals

**Goals**
- Customers self-serve packaged grab-and-go items and pay by card at the kiosk.
- Add Stripe to online ordering (ships first, before any kiosk hardware).
- One backend payments core shared across kiosk + online.
- Per-SKU inventory with an append-only movement ledger (future-agent-ready).
- Lock the tablet into a reliable, reboot-safe single-app kiosk.
- Pragmatic, low-cost loss prevention for a semi-supervised lobby.

**Non-goals (this phase)**
- No autonomous AI ops agent (pricing, restocking, supplier comms). Data model only.
- No made-to-order fulfillment at the kiosk (grab-and-go only; made-to-order stays online).
- No smart/locking coolers, no Just-Walk-Out vision, no thermal printer (email receipts).
- No alcohol / age-restricted SKUs (`age_restricted` modeled but kept 0).

## 3. Locked decisions

| Decision | Choice | Notes |
|---|---|---|
| Reader | **Start on the owned M2** ($0) | Native Capacitor + first-party Terminal SDK. WisePOS E (~$249) is a known drop-in upgrade if Bluetooth proves unreliable unattended. |
| Unattended hours | **Pursue Stripe written approval** | Pre-launch gate; fallback = card-present during staffed/semi-attended hours. |
| Catalog | **Split** | Grab-and-go SKUs separate from made-to-order menu items. |
| Online checkout | **Stripe-hosted Checkout** | Least code; SAQ A. |
| Capture mode | **Automatic** (default) | No fulfillment delay for grab-and-go. |
| Receipts | **Stripe email receipt** (default) | `receipt_email`; no printer, no SMS in v1. |
| Tipping | **Off** (default) | Unattended grab-and-go; M2 is screenless. |
| Tap to Pay (NFC) | **Ruled out** | Tablet is a Galaxy Tab A11 (SM-X130) — confirmed **no NFC**. Not revisitable on this hardware. |
| Mounting | **3D-printed mount** | Custom mount seats the tablet and positions the M2 prominently under the screen (solves "customers don't notice the reader"). Lockable enclosure optional. |

## 4. System architecture

```
                ┌─────────────────────────────────────────┐
                │            Express backend (Fly.io)        │
                │  server/lib/stripe.js  (single client)     │
                │  server/services/payments.js (core)        │
                │  routes/payments.js  ┌─ online (Checkout)  │
                │                      └─ kiosk  (Terminal)  │
                │  POST /api/stripe/webhook (express.raw)     │
                │  SQLite (better-sqlite3) on Fly volume      │
                └───────────▲───────────────────▲────────────┘
                            │                   │
              online (web)  │                   │ kiosk (native app)
                            │                   │
            ┌───────────────┴───┐   ┌───────────┴─────────────────┐
            │ Browser / web SPA │   │ Galaxy Tab (Capacitor app)  │
            │ Stripe Checkout    │   │ React SPA + ML Kit scanner   │
            │ redirect           │   │ Stripe Terminal SDK ↔ M2 BT  │
            └────────────────────┘   └─────────────────────────────┘
```

- **One React codebase** builds the web app *and* (via Capacitor) the kiosk app. A
  build-time/runtime flag (`isKiosk`) selects the kiosk shell (attract screen,
  scanning, self-checkout) vs. the existing web ordering UI.
- **Payments never touch card data in our code.** Online → Stripe Checkout (redirect).
  Kiosk → Terminal SDK + the reader handle the card; we only see PaymentIntents.
- **The backend is the source of truth for price/tax** (the existing `orders.js`
  already recalculates server-side — we keep that and create PaymentIntents from the
  trusted row, never from client-supplied amounts).

## 5. Backend: shared payments core

- Add the `stripe` npm package. `server/lib/stripe.js` exports one client configured
  from `STRIPE_SECRET_KEY` (set via `fly secrets set`, **never** `fly.toml [env]`).
- `server/services/payments.js`: `createPaymentIntent({ orderId, channel })` where
  `channel ∈ {'online','kiosk'}`. Amount derived from the trusted order row; sets
  `metadata: { order_id, channel }`; uses an **Idempotency-Key** per
  `(order, action, amount)` on every create/capture/refund.
- **Webhook (critical):** `server/index.js` calls `app.use(express.json())` globally
  (~line 78). The Stripe webhook route **must** be mounted with
  `express.raw({ type: 'application/json' })` **before** that line, or signature
  verification fails silently. One endpoint `POST /api/stripe/webhook` verifies the
  signature (`STRIPE_WEBHOOK_SECRET`) and switches on `metadata.channel`:
  - `checkout.session.completed` / `payment_intent.succeeded` → mark order paid.
  - `terminal.reader.action_succeeded` / `action_failed` → kiosk outcome.
  - On success: mark paid, **decrement inventory in the same DB transaction**, emit
    the existing socket.io event.
- New SQLite `payments` table + `payment_status` / `payment_intent_id` columns on
  `orders` (kept portable should we move to Postgres later). Add a `channel` column
  to `orders` (`'online' | 'kiosk'`).
- Test against Stripe **test mode** with `stripe listen --forward-to` before live keys.
- Consider `min_machines_running=1` on Fly once payments are live (avoid webhook
  cold-start gaps; Stripe retries mitigate but latency hurts the kiosk flow).

## 6. Online ordering payments — Phase 1 (ships first)

- Server creates a **Checkout Session** from the trusted order row; client redirects.
- **Fulfillment happens on the `checkout.session.completed` webhook**, never on the
  browser redirect (redirect can be lost/forged).
- Success/cancel return URLs land back in the existing app. SAQ A maintained.
- This delivers the "Stripe on online ordering" goal **before** any hardware arrives
  and validates the shared core.

## 7. Kiosk payments — Phase 2

- `@stripe/...` Terminal **native SDK** via Capacitor (community plugin
  `@capacitor-community/stripe-terminal`; **pin the version, monitor the repo** — its
  web target is experimental but we run on Android native).
- Backend endpoint mints **connection tokens** (`POST /api/stripe/terminal/connection_token`).
- Flow: discover + connect the **M2 over Bluetooth** → create `card_present`
  PaymentIntent (automatic capture) → `collectPaymentMethod` → `processPayment` →
  capture → outcome via webhook.
- Develop against the **simulated reader** first; then end-to-end approve/decline on
  the physical M2. Verify no PaymentIntent is ever left uncaptured.
- **Offline:** the native SDK supports store-and-forward offline payments — enable it
  for Wi-Fi-outage resilience (with its caveats: offline approvals can later decline;
  respect Stripe's offline limits). Pair with a graceful "checkout temporarily
  unavailable" screen.
- **Reader reliability:** keep the M2 **docked/charging** and paired; add a re-pair /
  reconnect watchdog. If field reliability disappoints, swap to a WisePOS E
  (server-driven) — a config change, not a rewrite.

## 8. Catalog & inventory data model — Phase 3 (split catalog)

- **Made-to-order menu** (`menu_items`, etc.) stays as-is for online ordering.
- **New grab-and-go domain** (separate product type, per the split decision):
  - `kiosk_products`: `id, sku, barcode (UPC, nullable), name, price_cents,
    quantity_on_hand, reorder_point, age_restricted (default 0), active`.
  - `inventory_movements` (append-only ledger): `id, sku, delta, reason
    ('sale'|'restock'|'adjustment'|'shrinkage'), order_id, created_at`. This is the
    clean, append-only state a future ops agent could read.
  - Kiosk orders use `orders.channel = 'kiosk'` with line items referencing
    `kiosk_products.sku` (exact line-item table shape is an implementation detail for
    the plan).
- All changes are **additive SQLite migrations** — no destructive change to existing
  tables.
- **Decrement stock only on confirmed payment success**, inside the order's DB
  transaction; hard out-of-stock check at pay time.
- Surface a **low-stock view** in the existing admin (reorder_point-driven).

## 9. Kiosk app shell, scanning & checkout UX

- **Item ID:** primary = **camera barcode scan** via `@capacitor-mlkit/barcode-scanning`;
  mandatory **tap-to-select product grid** fallback for house items without a UPC.
- **Self-checkout flow:** idle attract screen → tap to start → scan/tap to add (running
  total) → **"Did you scan everything?" review** (itemized list + total) → pay on
  reader → optional email receipt entry → auto-reset (watchdog returns to attract).
- **No manual add-item, no price override, no discount/comp field** anywhere in the
  kiosk UI (loss-prevention + Project Vend lesson).

## 10. Kiosk lockdown & physical security — Phase 4

- Provision the Galaxy Tab as an **Android Enterprise Device Owner** (free QR / 6-tap
  enrollment after factory reset) — this enables OS-enforced **Lock Task Mode**
  (not exitable, reboot-safe), unlike plain screen pinning.
- Install **Fully Single App Kiosk** (PLUS license, ~$11 one-time): lock to the app,
  Start on Boot, Restart After Crash, hidden nav/status bars, blocked other apps,
  scheduled reboot, keep-screen-on; admin (port 2323) behind a strong PIN on LAN; set
  OS updates to manual.
- Mount via a **3D-printed mount** that seats the tablet and positions the **M2
  prominently under the screen** (so customers can't miss it). Add a lockable steel
  enclosure only if anti-theft proves necessary; bolt down either way.

## 11. Loss prevention posture

Scan-required + visible deterrence + reconcile (no heavy hardware):
- Mandatory **scan-before-pay**; no manual/override path.
- "Did you scan everything?" confirmation (attacks the accidental-non-scan share).
- One visible **Wi-Fi camera** (~$25–36) + surveillance/"please scan all items"
  signage (audio off or post notice — Nevada is one-party for audio).
- Per-SKU barcodes + periodic **inventory reconciliation** against logged sales,
  segmented by time window (daytime vs evenings) after ~60–90 days.
- Price in a **3–5% shrink allowance**.

## 12. Stripe unattended-operation compliance (pre-launch gate)

Stripe Terminal does **not** permit *fully* unattended card payments. Decision:
**pursue written Stripe approval** for unattended operation before launch.
- **Gate:** do not flip the kiosk to fully-unattended evenings/weekends until written
  approval is in hand.
- **Fallback (so the build never blocks):** ship with card-present restricted to
  **staffed/semi-attended hours** (a server-side schedule flag), expand to 24/7 once
  approved.

## 13. Phasing & sequencing

- **Phase 0 — Spike (days):** confirm lobby Wi-Fi reliability; record exact Galaxy Tab
  model + Android version; open the Stripe unattended-approval request; confirm the
  live `tax_rate` setting; confirm automatic capture.
- **Phase 1 — Stripe backend + online Checkout:** shared PaymentIntent core, webhook
  (raw body before `express.json()`), `payments` table, online Checkout live in test
  then production. *Delivers the near-term online-Stripe goal.*
- **Phase 2 — Kiosk shell + Terminal:** Capacitor wrap, connection tokens, M2 pairing,
  card-present flow (simulated → physical), offline mode.
- **Phase 3 — Grab-and-go catalog + inventory:** split SKU model, inventory ledger,
  ML Kit scanning + tap-to-select, self-checkout flow, stock decrement on payment.
- **Phase 4 — Lockdown + loss prevention + deploy:** Device Owner + Fully Kiosk,
  enclosure, camera + signage, schedule flag, go-live; reconcile shrink after 60–90d.
- **Future (NOT now):** AI ops agent — reads the inventory ledger/reorder points;
  **hard-capped** against discounting, comping, or rerouting payment.

## 14. Hardware BOM

| Item | Have? | ~USD | Notes |
|---|---|---|---|
| Galaxy Tab A11 (SM-X130) | ✅ | $0 | Kiosk touchscreen; Android 15, **no NFC** (Tap to Pay impossible). |
| Stripe Reader M2 | ✅ | $0 | Kiosk reader (Bluetooth); keep docked/charging, mounted under the screen. |
| Fully Single App Kiosk PLUS | — | ~$11 | One-time, per device. |
| Mount / enclosure | — | $0–100 | 3D-printed mount (seats tablet, M2 prominent under screen); add a lockable steel enclosure only if anti-theft demands it. |
| Visible Wi-Fi camera + signage | — | ~$40 | Deterrent; add a 2nd only if shrink >5%. |
| Barcode labels (house items) | — | $0–20 | Vendor items use existing UPCs. |
| **WisePOS E (contingency upgrade)** | — | ~$249 | Only if M2 Bluetooth proves unreliable unattended. |

**~$150 to launch** on the M2; ~$400 if the WisePOS E upgrade is later needed.
Fees (not hardware): online Checkout ~2.9% + $0.30; in-person Terminal ~2.7% + $0.05.

## 15. Risks & mitigations

- **M2 Bluetooth reliability for always-on/unattended** → dock + charge, reconnect
  watchdog, graceful failure screen; WisePOS E is a config-swap upgrade.
- **Community Terminal plugin (no SLA)** → pin version, monitor repo; server-driven
  WisePOS E path is a clean fallback that doesn't use the plugin's native bridge.
- **No card payments without network** (even with offline mode, offline has limits) →
  reliable lobby networking + clear failure UX.
- **Stripe unattended policy** → written approval gate + staffed-hours fallback.
- **Shrinkage / friendly-fraud chargebacks ($15/dispute)** → scan-required, cameras,
  reconciliation, shrink allowance.
- **Webhook signature failures** → mount `express.raw` before global JSON parser.
- **Fly scale-to-zero** → consider `min_machines_running=1` once live.
- **DB is SQLite, not Postgres** → build payments/inventory in SQLite, keep portable.

## 16. Future: AI ops agent (readiness only)

The `inventory_movements` ledger + `reorder_point` give a future agent clean,
append-only state. Designed-in constraint **now**: no customer- or agent-facing
discount/comp/price-override/payment-reroute surface anywhere. Any future agent is
hard-capped against comping, discounting, or altering payment routing.

## 17. Open items to confirm

- Lobby Wi-Fi reliability (offline-mode reliance).
- Confirm production DB is SQLite (repo shows better-sqlite3; brief said Postgres).
- Whether a paper receipt is ever required by landlord/operator (default: email only).
