# Tuesday launch readiness — September 8, 2026

Reviewed September 5 Pacific time (September 6 UTC), branch `migration/vercel-supabase`, commit `cf42f3a`. Assessment only; no application, account, payment, or deployment changes made.

The application builds, but paid ordering is not launch-ready. The main work is activating integrations and completing fulfillment, refunds, and delivery reliability.

## Verified baseline

- `npm test`: 20 server tests passed. `npm run build`: passed. `npm run lint -w client`: passed.
- React/Vite storefronts, separate carts, server-side pricing/modifier validation, anonymous customer ownership, staff authentication, kitchen display, menu administration, image storage, Square checkout, Stripe Checkout, signed payment webhooks, and staged partner-menu import are implemented.
- Linked Vercel project: `muzecafe-kitchen-stage`. Its staging alias responds to `/api/health` with database healthy, partner import configured, **Square unconfigured, Stripe unconfigured, email unconfigured**.
- Supabase `muzecafe` is healthy. It contains 55 available café items, six available partner items for September 14, 54 image objects, and 212 orders with null payment provider/unpaid status. These records do not demonstrate successful new payment processing.
- Auth contains only one `legacy_archive` identity: **no staff or administrator accounts**.
- Latest linked staging deployment is READY, but reports commit `7b93269` and `gitDirty=1`. Its contents cannot be equated with current committed source. Rebuild from a clean, identified commit before acceptance testing.
- Hosted migration history includes all ten named migrations, but `configure_partner_meals` has hosted version `20260902234042` versus repository version `20260902233630`. Reconcile history and compare SQL before the next migration push; do not blindly reapply it.

## Required before accepting paid orders

| Priority | Work | Evidence and completion criteria |
| --- | --- | --- |
| P0 | Activate payments | Staging health reports both providers unconfigured. Configure Square browser application/location IDs plus server access token, location, environment, webhook signature key and exact notification URL. Configure Stripe secret/webhook secret and exact `CLIENT_URL`. Register webhook subscriptions. Verify sandbox success, decline, retry, delayed webhook, and refund, then production credentials and an owner-approved live transaction. |
| P0 | Create staff/admin access | Provision protected `app_metadata` roles using `server/scripts/createStaffUser.js`. Test staff kitchen access and admin menu access; verify staff cannot change admin-only data. |
| P0 | Fix café tax normalization | Hosted `tax_rate` is `0.08349999999999999`. `server/services/orderPricing.js:parseTaxRate` accepts at most six decimal places and silently falls back to 0.0825. The browser accepts the stored value. Reproduced with the actual pricing functions: a $100 basket displays $108.35 but the server prices $108.25. Confirm the business-approved rate, normalize stored settings, and make frontend/backend validation consistent. This finding does not determine the legally correct rate. |
| P0 | Complete cancellation/refund reconciliation | `server/db/database.js:cancelOrder` blocks paid/authorized cancellation. There is no provider refund implementation, and `server/routes/webhooks.js` does not process refund events. A dashboard refund therefore does not unlock cancellation or remove the order from fulfillment automatically. Minimum launch workflow: staff refunds through the provider dashboard, verified refund synchronization, then audited cancellation. Full in-app refund controls can follow. |
| P0 | Activate email and fix failure accounting | Gmail SMTP exists but is unconfigured. Sender functions return `{success:false}` instead of throwing; callers ignore the result. `pickupReminder.js` claims a reminder and counts it as sent even if email delivery failed. Confirmations lack a durable retry record. Add persisted delivery state/retries, recognize unsuccessful sends, bound SMTP timeouts, and prove receipt/ready/reminder delivery from the deployed app. |
| P0 | Make checkout recovery survive refresh | Checkout idempotency and Square attempt/token state live only in React refs in `CheckoutPage.jsx`. After a lost response, refreshing can produce a new order and another charge. Persist a recoverable checkout identity and reconcile the previous attempt before allowing a new one. Test lost response, refresh, double submit, and provider timeout. |
| P0 | Establish the production release path | Current project link is staging and lists only Vercel domains. Select the intended production project/domain, verify its environment independently, and deploy a clean commit. `.github/workflows/fly-deploy.yml` still deploys to Fly on `main`; replace/disable it before cutover and add test/build checks. Verify frontend routes, `/api`, webhooks, CORS, and Supabase configuration on the final origin. |
| P0 | Coordinate opening controls | `VITE_ORDERING_CLOSED=false` is required at build time to expose customer routes. The API independently checks `kitchen_open`, currently true in hosted settings. The frontend closure flag does not close the API. Keep server ordering paused during setup, then explicitly open it at launch. |

## Additional blockers if partner meals launch Tuesday

- **Partner handoff:** `enqueuePartnerHandoff` only inserts into `partner_order_handoffs`; there is no sender, export, acknowledgement, or retry worker. Agree on email/CSV/API/manual delivery and settlement ownership, then build a visible, auditable process that sends each paid order once and flags failures. Stripe Connect automation is optional if manual settlement is agreed.
- **Atomic paid-order work:** Stripe payment state commits before handoff enqueue and receipt delivery. If execution fails after payment commits, webhook retry sees no new paid transition and skips those actions. Insert durable handoff/notification work transactionally with the payment transition, or reconcile missing work independently.
- **Partner fulfillment screen:** KitchenDisplay requests the default café channel. Admin history has no partner channel/delivery-date/payment filters and its order detail is read-only. Add a partner packing/pickup list and actions to mark meals ready/collected, with schedule and payment status clearly shown.
- **Independent opening hours:** The shared kitchen toggle also blocks partner preorders. Separate café availability from weekly preorders if customers should order meals while the café kitchen is closed.
- **Payment cutoff semantics:** New partner orders are checked against Wednesday noon, but Stripe sessions expire 31 minutes after creation and webhook payment acceptance does not enforce the deadline. Existing order retries also skip current schedule validation. Decide whether the cutoff means checkout started or payment completed; enforce and test that decision.
- **Menu approval:** Six published meals currently target Monday September 14; their ordering deadline is Wednesday September 9 at noon Pacific. Review Monday's staged import, source date, meal selection, prices, descriptions, and allergens before Tuesday. Confirm permission for source retrieval and an owner responsible for publish/failure review. Keep automatic publication disabled until verified.

## Required verification and operational setup

- Run browser acceptance tests on a deployment built from the release commit: mobile menu/modifiers/cart, customer identity, both payment paths in scope, confirmation polling, kitchen update/reconnect, ready email, collected status, refund/cancel, staff access, and image upload.
- Add integration tests for webhook replay/crash recovery, provider amount/currency/reference validation, concurrent checkout recovery, and refund state. Existing payment tests cover routing/configuration/status mapping and Checkout payloads, not real provider round trips.
- Run the database policy suite on an isolated Supabase environment. Existing SQL tests check structure/grants; add two-customer ownership isolation and staff-role behavior tests. No database test suite or authenticated browser checkout was run during this audit.
- Schedule pickup-reminder retries: `vercel.json` schedules only Monday menu import. Hosted Supabase has neither `pg_cron` nor `pg_net` installed. Use an appropriate scheduler and verify bearer authentication and failure reporting. [Vercel's current limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) allow only daily frequency on Hobby; Pro supports minute-level scheduling.
- Review security advisor results in context: server-only tables intentionally have RLS without browser policies; anonymous customer policies require ownership checks, and kitchen Broadcast requires protected staff/admin claims. These findings alone are not evidence of exposed orders. [Anonymous policy guidance](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins). Leaked-password protection is disabled; [enable where supported](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Verify backup/restore and reconcile migrated menu/order totals against the legacy source. Take a cutover backup; retain the prior system read-only and document how orders accepted after cutover would be reconciled on rollback.
- Assign monitoring ownership for failed payments/webhooks, undelivered email, unacknowledged partner orders, and failed menu imports. Current health checks validate configuration presence/database access, not actual provider delivery.

## Suggested sequence

1. **Sunday September 6:** finalize launch scope, credentials, staff accounts, refund/handoff responsibilities; fix tax, checkout recovery, notification reliability and payment side-effect durability.
2. **Monday September 7:** complete partner operations if in scope; reconcile migration history; deploy a clean staging commit; run payment/refund/fulfillment acceptance tests; review the weekly menu; verify production settings and rollback.
3. **Tuesday September 8:** deploy the accepted release, verify final-domain routing and integrations, perform an approved live payment/refund check, then open ordering and monitor initial orders.

This is a proposed sequence, not a guarantee of completion. If partner handoff and pickup operations are not verified Monday, a café-only launch reduces scope. That requires explicit frontend and server channel gating; the current closure control is global. Defer automatic partner settlement, automatic menu publication, loyalty, SMS, delivery, and additional UI polish.
