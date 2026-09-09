# Muze Café Kitchen — completion audit

**Reviewed:** September 9, 2026  
**Repository:** `/home/rokai/muzecafekitchen`  
**Branch:** `migration/vercel-supabase`  
**Revision:** `cf42f3a986c62ae7c9b8f6e695eb01ab1e5601a5`  
**Scope:** Remaining work excluding adding/configuring Square payments and the Stripe backend. Assessment only; no application changes, accounts, orders, migrations, emails, deployments, or GitHub writes.

## Verdict

The project has a substantial implementation, not just a UI scaffold, but it is **not ready to accept real orders merely by adding payment credentials**. The main remaining work is data correctness, recoverable customer journeys, dependable notifications, partner fulfillment, and release verification.

The repository was already local. `git ls-remote --heads origin` confirmed that its current revision matches GitHub's `migration/vercel-supabase` branch. `main` is an ancestor, two commits behind this revision. No clone, fork, pull, branch change, or commit was needed. The existing untracked `LAUNCH_READINESS_2026-09-08.md` was preserved; its historical deployment/account claims were not treated as current proof.

## Verification actually performed

| Check | Result |
| --- | --- |
| `npm test` | **20 passed**, no failures/skips |
| `npm run build` | Passed |
| `npm run lint -w client` | Passed |
| `npm audit --omit=dev --json` and `npm audit --json` | No known vulnerabilities reported |
| Offline HTTP boundary checks against the actual Express app | Eight protected requests returned 401 without identity/cron secret; unknown API route returned 404 |
| Mobile browser smoke checks | Local frontend rendered café/partner menus, modifier selection, cart, checkout, and both staff sign-in screens. Customized cart survived navigation/reload. No horizontal overflow on checked mobile routes. |
| Unknown frontend route | Reproduced blank screen, rather than a not-found page |
| Pricing regression probes | Reproduced tax mismatch and Postgres DATE rejection using actual application functions and installed driver |
| Admin validation probe | Reproduced uploaded image URL being discarded by new-item validation |
| Notification probe | Actual unconfigured sender was incorrectly counted as a successfully sent reminder |
| Checkout-rate probe | Five unauthenticated attempts returned 401; the sixth returned 429, consuming the shared IP quota before authentication |

**Environment and scope limits:** Commands ran on Node **26.7.0**; `package.json:24-25` requests Node **24.x**. Repeat acceptance checks on the declared deployment runtime. Local Supabase/Docker access failed with permission denied, so database migrations, pgTAP, transaction/concurrency behavior, and full RLS isolation were not exercised. The saved Vercel environment export did not provide a usable database URL for direct local API testing.

Browser menu tests used the **current local frontend plus real public staging responses through a GET-only proxy**, not a locally running database. The proxy blocked order/auth/cron mutations. No staff login, anonymous-account creation, real checkout, Realtime authenticated session, email delivery, or provider round trip was performed. Public staging deployment source identity was not revalidated.

Read-only staging observations from `https://muzecafe-kitchen-stage.vercel.app`:
- `/api/health`: database healthy; email unconfigured; partner-menu import configured. Payment providers were also unconfigured but are outside this backlog.
- `/api/admin/public/settings`: café `tax_rate = "0.08349999999999999"`.
- `/api/admin/public/kitchen-status`: `open = true`.
- Public menu responses contained 55 café items and six partner meals, the latter dated September 14, 2026.

## Existing foundations worth keeping

- React/Vite storefront selector, separate café and partner carts, menu/modifier UI, and server-authoritative integer-cent pricing.
- Supabase customer ownership and protected staff/admin roles, with RLS migrations and server-side authorization. Missing-token rejection was verified; full role/ownership isolation remains a test gate.
- Transactional order/item creation, idempotency keys, lifecycle events, and legal fulfillment transitions.
- Café kitchen display with private Broadcast subscription and a 30-second polling fallback.
- Menu/category/modifier administration, image-upload infrastructure, and staged partner-menu review/publish APIs and UI.
- Wednesday-noon Pacific partner deadlines, Monday delivery representation, and allergen disclaimers.

These are implemented foundations, not a claim that every end-to-end flow passes.

## Must fix before launch

### 1. Normalize tax handling consistently

**Severity:** Launch blocker for café pricing. **Evidence:** Reproduced.

`client/src/pages/AdminPage.jsx:2214-2220` divides the percentage and saves its floating-point string. `server/services/orderPricing.js:31-36` accepts only up to six decimal places and silently falls back to 0.0825. The browser calculation accepts the current longer decimal (`client/src/utils/pricing.js:1-12`).

Using the live public setting and an explicit synthetic $100 basket with the actual pricing functions produced:

```text
stored tax rate: 0.08349999999999999
browser total:  $108.35
server total:   $108.25
difference:    10 cents
```

**Complete when:** The business-approved rate is stored canonically, invalid rates fail visibly, and frontend/server totals match for representative baskets and rounding boundaries. This audit does not determine the legally correct tax rate.

### 2. Fix PostgreSQL DATE handling for partner checkout and receipts

**Severity:** Launch blocker if partner meals are offered. **Evidence:** Reproduced offline with the installed driver.

`postgres` parses SQL DATE values as JavaScript `Date` objects (`node_modules/postgres/src/types.js:28-32`). `server/db/database.js:33-42` normalizes numbers but leaves dates untouched. `server/services/orderPricing.js:99` uses `String(menuItem.menu_week).slice(0,10)`, which is not an ISO date for a `Date` object. The JSON HTTP representation makes the menu appear correct in the browser, masking the direct database-to-pricing mismatch.

```text
same meal + ISO date string: prices successfully at 2059 cents
same meal + actual driver-parsed Date: PARTNER_SCHEDULE_INVALID
receipt date from Date object: ""
receipt date from ISO string:  "Monday, September 14, 2026"
```

Receipt formatting has the same assumption in `server/lib/partnerSchedule.js:80-89`.

**Complete when:** DATE-only fields have one canonical representation at the database boundary; pricing and receipt tests cover actual driver types, delivery dates, DST, and cutoff boundaries. Then confirm a real local/isolated Postgres checkout flow, without depending only on string-based unit fixtures.

### 3. Make customer notifications durable and truthful

**Severity:** Launch blocker for dependable fulfillment. **Evidence:** Static trace plus offline reproduction; staging reports email unconfigured.

- `server/routes/orders.js:373-377,410` starts ready/cancellation sends without awaiting them; a serverless invocation can finish first.
- `server/services/email.js:415-438,476-497` resolves a failure object rather than throwing on missing configuration or send failure.
- `server/services/pickupReminder.js:6-16` ignores that result and calls it sent.
- `server/db/database.js:966-976` sets the sent flag when claiming the work, before delivery.
- `vercel.json:34-39` schedules only partner-menu import, not reminders.
- `server/routes/webhooks.js:27-30,60-67` performs notification/handoff work after the payment-state transaction, only on a new paid transition; an interruption can leave missing work that transition-based replay does not recreate.

An offline fixture with the actual unconfigured email sender returned:

```json
{"scanned":1,"sent":1,"failed":0}
```

No email was sent and the claim was not released.

**Complete when:** Receipt/ready/cancel/reminder work has persisted delivery state, idempotency, retryable leases and bounded timeouts. Failed sends must remain retryable and visible to staff. Persist required fulfillment side effects transactionally or reconcile missing work independently. Configure a sender, schedule retries, and verify actual deliveries from the release deployment.

### 4. Finish partner handoff and pickup operations

**Severity:** Launch blocker if partner meals are offered. **Evidence:** Static implementation trace.

`server/db/database.js:688-711` inserts into `partner_order_handoffs`, but the inspected code has no dispatch worker, acknowledgement path, retry processor, or manual export/processing workflow. `client/src/pages/KitchenDisplay.jsx:71-80` calls `orderAPI.getActive()` without a channel, which defaults to café (`client/src/utils/api.js:116`). Partner orders therefore have no equivalent operational kitchen screen. History lacks channel/delivery-date filters (`server/db/database.js:979-1001`).

Also, pickup counters reset by **order creation date** (`server/db/database.js:461-477`), rather than partner delivery date. Orders placed on different days for the same Monday can share a pickup number.

**Complete when:** There is an agreed email/CSV/API/manual handoff process with visible sent/acknowledged/failed states, retry ownership, and a date-specific packing/pickup list. Staff can find partner orders, mark preparing/ready/collected, and distinguish all pickups for the delivery day. Automated partner settlement is optional if a documented manual process is agreed.

### 5. Make order recovery survive refreshes and network failures

**Severity:** High. **Evidence:** Static client/server flow trace.

- Checkout idempotency and attempt identifiers live only in component refs (`client/src/pages/CheckoutPage.jsx:32-35,79-87`). They disappear on refresh even though the cart survives.
- Last-order recovery is saved only after a successful response (`CheckoutPage.jsx:116-128`); a lost response leaves no durable order identity.
- Café active-order recovery deletes its saved reference on any request error (`client/src/pages/MenuPage.jsx:70-88`), including a temporary outage.
- Confirmation turns all errors into “Order not found” (`client/src/pages/ConfirmationPage.jsx:28-43`).
- Confirmation polling removes the entire channel cart whenever the viewed order is paid (`ConfirmationPage.jsx:32-34`), without checking whether that cart belongs to a newer checkout.
- The partner last-order key is written, but the partner storefront has no matching recent-order recovery UI. Losing an anonymous session correctly prevents access to its old orders, but no verified recovery/linking flow is implemented (`client/src/utils/api.js:18-23`).

**Complete when:** Persist a recoverable checkout identity before submission, scope cart clearing to the submitted cart, reconcile unknown outcomes before allowing a fresh order, and preserve references during outages. Add a usable partner order-recovery path and decide whether secure email-based cross-device recovery is required. Test refresh, response loss, multiple tabs, a new cart while viewing an older order, and expired identity.

### 6. Unify opening controls at the server, with per-storefront gates

**Severity:** High. **Evidence:** Static trace and current public setting.

`client/src/config/closure.js:12-15` closes the frontend at build time. `server/routes/orders.js:73-90` does not check that setting; it only checks `kitchen_open`, currently true on staging. Once other prerequisites are configured, a closed UI does not itself prevent direct authenticated order submissions. Conversely, closing the café kitchen blocks partner preorders too.

`client/src/App.jsx:21-27` also hides customer confirmation routes during closure, potentially preventing existing customers from checking pickup status.

**Complete when:** The API enforces explicit café and partner acceptance settings, aligned with their hours/cutoffs. New ordering can be paused without hiding existing-order status/support. Missing status/configuration should not be presented as “open.” A café-only launch must disable partner ordering on the server as well as hiding its UI.

## Finish for a dependable production operation

### 7. Complete admin CRUD validation and image persistence

**Severity:** High for operator correctness. **Evidence:** Image loss reproduced; remaining paths statically traced.

`server/validators/schemas.js:65-73` omits `image_url`, so validation strips it before new-item creation (`server/routes/admin.js:279-292`). An offline validator probe confirmed a valid uploaded URL is not preserved.

Updates bypass equivalent validation (`admin.js:300-306,362-376,404-420`). `server/db/database.js:3-6,156-162` converts invalid prices to zero and converts nonempty strings such as `"false"` to true. Item writes precede modifier-link writes, allowing partial changes if linkage fails.

**Complete when:** Create/update schemas preserve allowed image fields, reject malformed prices/booleans/cardinalities, and apply item-plus-modifier changes atomically. Failed admin operations must be visible in the UI. Verify create with image, edit, availability, modifier links, invalid input, and rollback.

### 8. Adapt rate limits for shared office Wi-Fi and serverless hosting

**Severity:** High under shared-IP traffic. **Evidence:** Offline HTTP reproduction.

`server/middleware/rateLimit.js:7-17` permits five order attempts per IP per 15 minutes using the default in-memory store. The limiter precedes authentication, validation, and idempotency handling (`server/routes/orders.js:73`). Five customers sharing office NAT—or one customer retrying failures—can exhaust one another's quota. Different serverless instances do not share that counter.

**Complete when:** Abuse limits are durable and identity-aware where appropriate, with a carefully chosen broader IP fallback. Valid idempotent recovery should not be treated as another new order. Load-test realistic office-NAT and retry traffic; do not simply remove abuse protection.

### 9. Correct reporting and weekly-menu publication safeguards

**Severity:** Medium/high operational correctness. **Evidence:** Static trace; duplicate menu content observed live.

- Revenue sums all non-cancelled order totals, including unpaid/failed checkout records (`server/db/database.js:1014-1041`). Label and calculate paid revenue, pending orders, and fulfillment separately.
- Publication locks the import run, not the partner's active menu; it permits older staged runs without a freshness check and disables current items (`database.js:792-828`). Add per-partner serialization, schedule/freshness validation, and an explicit reviewed rollback path. Concurrency behavior was not database-tested.
- Candidate review omits source schedule/allergen fields even though publication consumes them (`client/src/pages/AdminPage.jsx:1094-1120`; `database.js:821-848`). Expose the actual source date, delivery week, cutoff, and allergy data for approval.
- Public café data has two **Blue Hawaiian** items: ID 56 at **$8**, ID 19 at **$7**. Confirm whether they are intentional variants; otherwise merge/disable the stale entry. No catalog changes were made.

### 10. Establish a tested release, access, and recovery path

**Severity:** Release gate, not proof that hosted setup is absent.

- The checked-in GitHub workflow still runs `flyctl deploy` on `main`, with no test/build gate (`.github/workflows/fly-deploy.yml:4-18`), despite the Vercel migration. Replace or deliberately retire it and verify the intended deployment trigger.
- Identify the actual production project/domain, deploy from a clean known commit, verify environment/origin/redirect settings, and repeat checks on Node 24.x.
- Verify actual staff and administrator accounts, kitchen access, admin-only denial for staff, account reset/support, and role revocation. Sign-in screens and provisioning code exist; account inventory/login was not verified here. Do not infer today's account state from the old report.
- Run database tests in an isolated Supabase environment. `supabase/tests/database/security.test.sql` primarily checks schema/grants; add real two-customer isolation, protected-role, Realtime authorization, and lifecycle/concurrency cases. There is no client test script in `client/package.json:6-10`.
- Add frontend/API integration coverage for the regressions above and authenticated fulfillment acceptance tests.
- Verify hosted migration history against source before the next push. The older audit's drift claim needs a fresh comparison, not blind repair/reapplication.
- Managed-backup endpoints only report that Supabase handles backups (`server/routes/admin.js:490-508`); that is not evidence of enabled retention or a successful restore. Verify plan/retention, test restore, preserve the legacy snapshot, reconcile migrated records/images, and document rollback without simultaneous writes to both systems.
- Monitor failed emails, pending/unacknowledged partner handoffs, failed/stale imports, order errors and API/database health. `/api/health` reports configuration presence and a database query, not successful delivery.

### 11. Close smaller customer UX gaps

**Severity:** Medium/low; after the launch blockers.

- Add a useful catch-all route in the open-site route tree (`client/src/App.jsx:30-44`). A nonexistent route currently renders a blank page; reproduced in the browser.
- Add programmatic labels to checkout name/email inputs (`client/src/pages/CheckoutPage.jsx:207-235`).
- The checkout button is outside its form and invokes the handler directly (`CheckoutPage.jsx:300-306`), bypassing native email-form validation. The backend still validates email; align the frontend and return field-specific errors before an attempted checkout.
- Audit dialogs for keyboard focus, accessible roles, focus return, and clear failure/loading states. This was not a full accessibility assessment.

## Payment-dependent lifecycle caveats, kept separate from provider additions

Square/Stripe credential activation and new provider implementation are excluded from this backlog. However, the order lifecycle still needs an agreed cancellation/refund policy before paid launch: current code deliberately rejects cancellation of paid/authorized non-cash orders (`server/routes/orders.js:342-348,394-398`; `server/db/database.js:882-888`). Do not present cancellation as supported until a verified refund/reconciliation process exists.

Existing-order retries also reuse orders without checking terminal fulfillment status (`server/routes/orders.js:119-143,190-203`) and skip current schedule validation (`134`). Ensure cancelled/completed orders cannot restart checkout, and explicitly decide whether the partner cutoff means checkout started or payment completed. These are acceptance requirements for the payment workstream, not a recommendation to bypass its safeguards.

## Recommended sequence

1. **Correctness:** tax normalization, Postgres DATE normalization, admin image/validation fixes, paid-revenue reporting.
2. **Reliability:** durable notifications and side effects, checkout/order recovery, server-authoritative opening controls, shared-IP-safe rate limiting.
3. **Partner operations, if included:** handoff transport/acknowledgement, packing and pickup UI, delivery-day identifiers, menu approval/freshness checks.
4. **Release gate:** verified staff roles, isolated DB/RLS and browser tests, clean Vercel release/CI, backup restoration, monitoring and rollback.
5. **Polish:** 404, accessible form/dialog behavior, catalog cleanup and secondary UX.

A café-only launch reduces scope, but only after the café blockers and explicit server-side partner disabling are verified. No defensible completion percentage or time estimate can be derived solely from passing the existing unit tests.
