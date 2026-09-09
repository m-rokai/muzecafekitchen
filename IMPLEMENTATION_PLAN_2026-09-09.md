# Muze Cafe Kitchen — implementation plan

**Status:** proposed execution plan; implementation has not started. **Deployment:** existing Vercel/Supabase project only. **Implementation:** Luna Max. **Oversight/review:** Astra Xhigh.

# Live Vercel verification — implementation-plan update

**Verified read-only on September 9, 2026. This section supersedes unknown-hosting assumptions in the source audit and draft plan.** No Vercel project was created, linked, redeployed, promoted, reconfigured or upgraded.

## Existing project: reuse it

- **Project:** `muzecafe-kitchen-stage`
- **Project ID:** `prj_BEsPuXhlUUkLlcWCOmVWOPA5jLzx`
- **Scope:** `mrokais-projects` (`team_PeFsEju1eYXXiqOmX9ZeMjAE`)
- **Dashboard:** https://vercel.com/mrokais-projects/muzecafe-kitchen-stage
- **Public alias:** https://muzecafe-kitchen-stage.vercel.app
- **Linked locally:** `.vercel/project.json` agrees with the authenticated project API.
- **Runtime/build:** Node `24.x`, `npm run build`, output `client/dist`, API entrypoint `api/index.js` with `maxDuration: 30`, region `iad1` on the aliased deployment.
- **Plan:** active **Hobby**, confirmed from the authenticated team API—not an assumption.
- **Existing scheduled job:** `/api/cron/partner-menu`, expression `0 16 * * 1`. No notification/reminder cron is present in the active deployment's schedule metadata.
- **Git connection:** the project API returned no Git-link object and the inspected deployments report `source: cli`. Establish a reproducible release mechanism for this EXISTING project; do not create a replacement or silently connect Git/push.
- The project name contains “stage,” but Vercel labels the alias target as `production`. A name is not environment isolation. Before any authorized preview test or release, verify separate data/identity/send destinations. The presence of variable names across Production/Preview/Development is not proof of isolated values; no secret values were downloaded.

## Active deployment is identified, not assumed latest

The dedicated alias API and the project's `targets.production` both identify **`dpl_8xcNNuwMxZerPGa86vbVNHfPBSDU`** as the current alias target, URL `muzecafe-kitchen-stage-4cjk8z3zy-mrokais-projects.vercel.app`, state `READY`.

Vercel also lists the newer READY deployment **`dpl_7X82rNgqGWkeM1Hqj4PJNYMHJLS9`**, URL `muzecafe-kitchen-stage-bkgjgy7eg-mrokais-projects.vercel.app`. Both deployment records contain the alias in their alias-history metadata, so that list alone is NOT proof of the current mapping. The dedicated alias lookup resolves this ambiguity; do not promote either deployment automatically.

Both inspected deployment records have Git metadata `migration/vercel-supabase` at **`7b9326917f4c3161fc1271ed74ca88550fcc952c`**. Local HEAD is **`cf42f3a986c62ae7c9b8f6e695eb01ab1e5601a5`**, with `Migrate ordering platform to Vercel and Supabase` in that Git range. Treat CLI-uploaded Git metadata as provenance metadata, not proof that uploaded files were a clean commit. The release package must reconcile artifact provenance and produce a tested clean-snapshot release; do not claim that live contains or lacks every local fix solely from the SHA.

## Health and configuration evidence

A fresh public GET of `/api/health` returned `status: ok`, `database: ok`, partner-menu import configured, and email unconfigured. The authenticated production environment-name listing included database/auth, storefront, partner import and cron configuration names, but no email-sender configuration names. Secret values were not read or changed. New Square/Stripe work remains excluded; health reports both unconfigured, so no paid-launch readiness is claimed.

## Required updates to the plan

1. **Reuse the verified existing project.** Replace “identify whether a Vercel project exists” or “create a Vercel project” with verify/reconcile this target and isolate preview data/sends. Fly.io stays ignored.
2. **Preserve runtime alignment:** Node 24 is confirmed on Vercel; rerun local acceptance on Node 24.11.1. The prior Node 26 test result is not Node 24 evidence.
3. **Hobby is a concrete scheduling constraint:** Vercel Hobby allows cron at most daily with within-hour precision. It cannot be the sole timely pickup/reminder/retry dispatcher. Queue source code and offline tests may proceed, but frequent scheduling and notification service-level acceptance require an owner-approved compatible plan/scheduler. Do not add a minute-frequency cron that will fail Hobby deployment. Do not purchase or upgrade anything without consent.
4. **Commercial-use eligibility is a release gate:** Vercel's Hobby documentation restricts use to personal, non-commercial projects. This is a business ordering application. Resolve the project's eligible Vercel plan with the owner before commercial launch; no subscription change is authorized by this review.
5. **Durable retry is application-owned:** Vercel does not retry failed cron requests. Missed/duplicate/overlapping runs are possible; use persisted due work, atomic leases and reconciliation, with requests bounded below the configured 30-second limit. Reject missing/invalid cron authorization. SMTP acceptance is not confirmed inbox delivery, and ambiguous sends must be represented honestly.
6. **Cron rollback is explicit:** Vercel Instant Rollback does not reset active cron schedules. The rollback runbook must account for schedule configuration, in-flight work, compatible schema and monitoring; app rollback is not DB rollback.
7. **Existing deployment is not a fresh acceptance build:** the current alias is identified above. Keep it unchanged until the owner approves a verified release artifact and promotion. Do not copy hosted secrets into local test workspaces to reproduce the deployment.

## Evidence

Sanitized API results: `/home/rokai/.hermes/reports/muzecafekitchen/vercel-project-snapshot.json`. Reads used authenticated `vercel project inspect`, `vercel inspect`, and explicit GET API calls for the exact project/team/deployments/alias, plus environment-name listing and public health. CLI `whoami` succeeded as `m-rokai`. No external writes occurred.

Official references (checked during planning):
- https://vercel.com/docs/cron-jobs/usage-and-pricing
- https://vercel.com/docs/cron-jobs/manage-cron-jobs
- https://vercel.com/docs/functions/configuring-functions/duration
- https://vercel.com/docs/plans/hobby

---


**Proposed implementation plan — Muze Cafe Kitchen**

This is a planning artifact, not implementation evidence. The planning author inspected source read-only. The overseeing session separately verified the existing Vercel project read-only as recorded above. No application/test/SQL/configuration code changes, project tests, migrations, commits, pushes or deployments were performed.

Read-only inspection confirmed branch `migration/vercel-supabase` at `cf42f3a986c62ae7c9b8f6e695eb01ab1e5601a5`, with no tracked changes. Preserve both untracked owner documents:

- [COMPLETION_AUDIT_2026-09-09.md](/home/rokai/muzecafekitchen/COMPLETION_AUDIT_2026-09-09.md)
- [LAUNCH_READINESS_2026-09-08.md](/home/rokai/muzecafekitchen/LAUNCH_READINESS_2026-09-08.md)

The completion audit provides reproduced findings, static findings, and verification gaps. This inspection corroborated relevant source paths but did not reproduce runtime behavior. Frontend and operations supplement delegates returned unusable completion errors; neither counts as completed review.

The prior 20 server tests, build, lint, and dependency audits passed on Node 26. They are historical baseline evidence, not Node 24 or release acceptance. Node 24.11.1 is available according to the assignment. Docker/Supabase execution remains blocked by Docker permission denied.

**Scope and approval boundaries**

Use the existing React/Vite, Express, Zod, and postgres/Supabase architecture.

In scope: pricing and dates; admin correctness; reporting; opening controls; recoverable checkout identities; non-payment lifecycle safeguards; durable notification intent; partner operations and publication; distributed abuse protection; accessibility; testing; Vercel verification; recovery and release documentation.

Excluded: new Square payment implementation, Stripe backend implementation, payment credentials, real provider transactions, broad framework changes, microservices, and additional paid queue/Redis dependencies. Existing payment and refund safeguards remain mandatory. Paid launch remains blocked on the separate provider/refund workstream.

Fly.io artifacts are historical and entirely outside this plan. The audit’s Fly recommendation is superseded by the user, not unfinished work.

| Approval | Meaning | Does not authorize |
|---|---|---|
| Planning approval | Accept scope, dependencies, acceptance criteria, and proposed technical defaults. | Implementation, Git writes, hosted changes, or opening a channel. |
| Local implementation authorization | Permit named Luna packages in assigned isolated workspaces. | Commits, PRs, pushes, hosted provisioning, migrations, emails, or deployments. |
| Implementation acceptance | Fresh-context Astra accepts a specific reviewed snapshot with required evidence. | Production release or channel opening. |
| Production release approval | Owner approves the concrete commit/artifact, schema changes, configuration boundary, runbook, and applicable launch gates. | Unlisted changes or automatic opening of another channel. |

Commits, PR creation, and pushes each require separate authorization. A push may trigger Vercel automation; establish that boundary before requesting push approval.

**Delivery model**

All implementation—including tests, SQL, harnesses, CI/configuration changes, and correction edits—must be authored by **Luna Max: `gpt-5.6-luna`, effort `max`**.

Design, guidance, independent review, and acceptance/rejection must use **Astra Xhigh: `gpt-6-astra`, effort `xhigh`**. Astra must not author implementation or tests.

The requested model/effort pairs were verified in the installed catalog and actual read-only CLI startup logs during planning. Continue verifying every future worker startup; implementation requires the appropriate workspace-write sandbox and its scoped authorization:

```text
Luna:  codex exec --model gpt-5.6-luna -c 'model_reasoning_effort="max"' …
Astra: codex exec --model gpt-6-astra -c 'model_reasoning_effort="xhigh"' --sandbox read-only …
```

For every initial process and correction process:

- Capture CLI version and startup logs showing the effective model and reasoning effort.
- Verify the effective values before work proceeds. Requested flags alone are insufficient evidence.
- Fail closed if the requested model/effort is unavailable, substituted, or unverifiable. Escalate; do not use a fallback.
- Apply settings per process. Do not change global Hermes or Codex configuration.

Future implementation may use isolated worktrees for independent files after local implementation authorization. Preserve owner work; never stash, reset, clean, or overwrite it. Without commit authorization, run dependent packages sequentially in their assigned workspace. After authorized landing, rebase adjacent work before continuing.

The principal collision hotspots are:

- [server/db/database.js](/home/rokai/muzecafekitchen/server/db/database.js)
- [server/routes/orders.js](/home/rokai/muzecafekitchen/server/routes/orders.js)
- [client/src/pages/AdminPage.jsx](/home/rokai/muzecafekitchen/client/src/pages/AdminPage.jsx)

Also serialize overlapping changes to schemas, pricing, `api.js`, `App.jsx`, package manifests/lockfile, and `vercel.json`. Do not run multiple Luna writers against overlapping files.

**Business decisions and technical defaults**

Only business-critical policy decisions should hold channel opening. They should not delay self-contained offline fixes.

| Owner decision | Required before | Interim behavior |
|---|---|---|
| Launch café, partner meals, or both; intended service hours | Opening the applicable channel | Both server acceptance gates default closed. Tracking remains reachable. |
| Confirm applicable tax rates and inclusive/exclusive treatment | Pricing configuration acceptance and channel opening | Preserve historical amounts; reject unknown configuration. The observed float artifact is a regression fixture, not a legal rate determination. |
| Partner transport, acknowledgement owner, retry ownership, and manual settlement responsibilities | Partner opening | Stage work and show its state; do not assume an export or SMTP acceptance means partner acknowledgement. |
| Whether cutoff means checkout started or payment completed; treatment of late/unknown outcomes | Partner opening | Reject new checkout initiation after cutoff; preserve recovery and financial truth. Do not automatically release ambiguous late orders to fulfillment. |
| Whether secure cross-device recovery is required | Customer recovery product acceptance | Same-session/device recovery remains ownership-bound; lost identity shows support guidance without granting access. |
| Cancellation/refund handling, including in-flight and late payment outcomes | Paid launch | Preserve `REFUND_REQUIRED` and existing restrictions; never claim a refund or “not charged” without evidence. |

Low-risk technical defaults proposed here:

- Integer-cent arithmetic with one documented rounding rule and canonical decimal tax configuration.
- SQL `DATE` values represented as `YYYY-MM-DD`; timestamps remain instants.
- Pacific calendar boundaries for café service dates and partner scheduling.
- Server-authoritative channel gates; unavailable configuration is not “open.”
- Minimal Postgres-backed durable work, subject to a fit review.
- At-least-once notification attempts with explicit uncertainty; no exactly-once email claim.
- Synthetic offline fixtures and isolated test identities; no production credential discovery.

**Work packages**

Priorities: **P0** blocks the applicable ordering/release gate; **P1** is required operational correctness or dependable UX; **P2** is secondary polish. Applicability: **C** café, **P** partner, **Both** shared, **Release** delivery infrastructure.

Every package starts proposed. “Completion evidence” below describes future evidence required; it does not report completion.

1. **WP01 — Establish a safe Node 24 verification workspace**  
   **Priority/applicability:** P0, Both/Release.

   **Sources:** Root/server/client `package.json`, `package-lock.json`, [server/app.js](/home/rokai/muzecafekitchen/server/app.js:1), existing tests, and Vite configuration.

   **Problem to reproduce:** `server/app.js` imports `dotenv/config`; Vite also loads environment files. Running commands in an ambient workspace can load live credentials. The recorded baseline used the wrong Node major.

   **Bounded scope:** Luna creates a local verification launcher and synthetic configuration under the assigned workspace. Allowlist child-process environment variables, suppress implicit secret-file loading, and reject non-test service destinations before app imports. Review dependency lifecycle scripts before installation; use locked dependencies only in this workspace. Record the actual child Node executable/version. No application behavior changes in this slice.

   **Dependencies:** Local implementation authorization and verified Luna startup settings.

   **Acceptance:** Positive—reviewed existing tests/build/lint execute with Node 24 and explicit synthetic configuration. Negative—missing test configuration, unexpected external targets, ambient credential variables, or attempted dotenv escape abort before requests or mutation. Demonstrate the protection with synthetic sentinels, never real credentials.

   **Astra checklist:** Import-time side effects, Vite environment resolution, subprocess inheritance, network boundaries, lifecycle scripts, log redaction, and owner-file preservation.

   **Completion/blocked evidence:** Launcher diff, runtime log, boundary-test results, and fresh baseline logs. Database work remains separately blocked; this package must not “fix” Docker permissions.

2. **WP02 — Add focused frontend and actual-API test harnesses**  
   **Priority/applicability:** P0, Both.

   **Sources:** Existing server tests, [server/app.js](/home/rokai/muzecafekitchen/server/app.js), `client/package.json`, Vite configuration, and proposed test-support files.

   **Problem to reproduce:** There is no client test script. Existing tests largely exercise isolated functions; auth tests do not establish a real JWT/RLS flow.

   **Bounded scope:** Keep Node’s server test runner. Add minimal Vite-compatible frontend/component tooling and browser tooling as pinned development dependencies. Test actual components and Express routing with narrowly scoped dependency seams where necessary. Maintain explicit offline menu/auth/provider/SMTP fixtures and deterministic clocks.

   **Dependencies:** WP01; exclusive ownership of manifests and lockfile.

   **Acceptance:** Positive—one actual component interaction and one actual Express boundary test run through the harness. Negative—unexpected fetches fail, missing fixtures fail, and a deliberately failing assertion produces a nonzero result. Include cleanup checks for timers, servers, mocks, and sessions.

   **Astra checklist:** No duplicate implementation masquerading as a test; no test-only bypass reachable in production; fixtures carry explicit channels and identities. Existing pricing fixtures sometimes omit both item and order channel—correct fixture realism without weakening validation.

   **Completion/blocked evidence:** Harness diff, intentional-failure evidence, passing smoke evidence, exact commands, and runtime. No claim of real database or authenticated Supabase coverage.

3. **WP03 — Canonical money calculation and tax parsing**  
   **Priority/applicability:** P0, Both.

   **Sources:** [server/services/orderPricing.js](/home/rokai/muzecafekitchen/server/services/orderPricing.js), [client/src/utils/pricing.js](/home/rokai/muzecafekitchen/client/src/utils/pricing.js), pricing tests; a small shared pure money module is proposed.

   **Problem to reproduce:** Server tax parsing silently substitutes `0.0825` for a long decimal, while the browser accepts it. The audit reproduced a ten-cent discrepancy on a synthetic $100 basket.

   **Bounded scope:** Establish one pure, runtime-neutral money contract. Represent rates with fixed decimal precision, proposed as millionths of one unit rate. Use integer arithmetic with sufficient intermediate precision and checked output bounds. Preserve café tax-exclusive and partner tax-inclusive calculations. Document nonnegative half-up rounding at the basket level.

   New writes use canonical decimal strings. A separate legacy-read compatibility rule may normalize a value only when it lies within a tightly documented tolerance of the supported decimal grid; it must not round arbitrary higher-precision rates. Missing or invalid configuration returns a typed error, never a replacement rate.

   **Dependencies:** WP01. Serialize with WP05 because both touch order pricing.

   **Acceptance:** Positive—exact shared results for canonical rates, the known float artifact, cent-rounding boundaries, quantities/modifiers, and inclusive totals. Negative—blank/missing/invalid rates, out-of-range rates, materially excessive precision, negative amounts, and overflow fail explicitly; client money fields remain untrusted.

   **Astra checklist:** Mathematical rule, tolerance justification, both storefronts, signed modifier handling, safe integers, and no legal-rate selection.

   **Completion/blocked evidence:** Actual-source failing-before/passing-after matrix and a narrowly scoped diff. This pure calculation slice can be accepted offline; complete channel pricing still requires WP04.

4. **WP04 — Carry canonical tax through settings, carts, and administration**  
   **Priority/applicability:** P0, Both.

   **Sources:** `server/routes/admin.js`, `server/validators/schemas.js`, `server/db/database.js` setting functions, `AdminPage.jsx` settings section, `client/src/utils/api.js`, cart context, and pricing consumers.

   **Problem to reproduce:** Admin percentage division creates float artifacts. Public settings and client API helpers silently supply fallback rates. Cart calculations accumulate dollar values separately from authoritative cents.

   **Bounded scope:** Validate tax settings by key; convert percentage text to canonical rate text without binary division. Preserve precision in display/edit round trips. Return the same canonical configuration used by server pricing, with explicit invalid/unavailable states. Sum cart line amounts in cents before displaying totals.

   Prepare a narrowly targeted, reviewable normalization procedure for existing settings: show old/canonical values, require the expected old value, record the change, and preserve historical order amounts. Do not execute it or choose the business rate automatically. Remove hard-coded amount/tax copy where it can contradict configured prices.

   **Dependencies:** WP03, WP02 for UI tests; serialize shared admin and database files.

   **Acceptance:** Positive—save/reload percentages including `8.375` without lost precision; browser/server totals agree. Negative—invalid or unavailable settings disable checkout; unsupported precision is visible; an unexpected stored value stops normalization. Explicitly create a synthetic order snapshot, then change catalog prices/modifiers and tax settings: existing order items, receipt amounts, recovery amounts, and stored-amount reporting must remain unchanged. Only a new order may use the new configuration.

   **Astra checklist:** No fallback rate remains in an ordering path, no incidental settings reset, no misleading tax labels, and no unapproved catalog/configuration mutation.

   **Completion/blocked evidence:** API/component regressions, rounding matrix, proposed data-change preview, and diff. Channel opening stays blocked until the owner confirms its tax configuration.

5. **WP05 — Normalize SQL dates and make scheduling timezone-safe**  
   **Priority/applicability:** P0 for P; shared date/reporting correctness for Both.

   **Sources:** [server/db/postgres.js](/home/rokai/muzecafekitchen/server/db/postgres.js), `database.js` normalization and date consumers, server/client partner-schedule helpers, order pricing, receipt tests, and schedule migration.

   **Problem to reproduce:** SQL `DATE` becomes a JavaScript `Date`; `String(value).slice(0,10)` then rejects a valid partner menu date and blanks receipt delivery text. Timestamp slicing can also choose the wrong calendar day for an offset timestamp.

   **Bounded scope:** Prefer a verified, narrowly scoped postgres SQL `DATE` type mapping at the driver boundary. Preserve timestamp/timestamptz semantics. Update schedule consumers to use explicit date-only versus instant conversion. Handle compatibility representations only at identified boundaries, not by truncating arbitrary values. Validate real calendar dates and Monday delivery.

   **Dependencies:** WP03 landed or otherwise serialized; WP22 for real-driver/database acceptance.

   **Acceptance:** Positive—actual installed-driver types, canonical SQL dates, receipts, year/month/leap boundaries, Pacific noon deadlines in standard/daylight time, and delivery weeks spanning both DST changes. Negative—invalid dates, invalid Monday delivery, malformed timestamps, mixed weeks, and cutoff equality/after-boundary cases reject. Test offset timestamps crossing UTC/Pacific midnight. Confirm timestamps retain their time component.

   **Astra checklist:** No global conversion of all `Date` objects; no host-timezone dependency; server/client parity; explicit cutoff clock.

   **Completion/blocked evidence:** Offline type/regression results plus real isolated SQL `DATE`→pricing→order→receipt evidence. Until the latter runs, database-integrated acceptance is blocked.

6. **WP06 — Apply complete admin create/update contracts**  
   **Priority/applicability:** P1, Both.

   **Sources:** [server/validators/schemas.js](/home/rokai/muzecafekitchen/server/validators/schemas.js), `server/routes/admin.js`, validator/API tests.

   **Problem to reproduce:** New-item validation strips `image_url`; update and modifier routes bypass equivalent validation. Availability converts `"false"` to true.

   **Bounded scope:** Add explicit create and update schemas for categories, items, modifier groups/options, availability, and link replacement. Validate IDs, finite cent-representable prices, supported booleans, bounded arrays, duplicate links, and cardinality relationships. Partial updates validate the resulting merged record where cross-field invariants require it.

   Preserve allowed image URLs: credential-free HTTPS and any explicitly supported safe legacy asset path. Reject unsafe schemes and malformed paths. Do not silently coerce malformed money to zero. Preserve legitimate signed modifier adjustments within the final-price constraint.

   **Dependencies:** WP01/WP02; serialize schemas with WP04.

   **Acceptance:** Positive—create with uploaded image, valid partial update, image removal, zero price where supported, and correct modifier constraints. Negative—`"false"`, malformed IDs/prices, nonfinite numbers, contradictory min/max/required values, invalid URLs, and malformed link arrays return field-specific errors.

   **Astra checklist:** Create/update consistency, absent-versus-null semantics, sanitization after validation, unknown fields, and no authorization changes.

   **Completion/blocked evidence:** Validator and actual-route RED/GREEN results. Database atomicity is explicitly deferred to WP07.

7. **WP07 — Make item/link writes atomic and admin failures visible**  
   **Priority/applicability:** P1, Both.

   **Sources:** `database.js` menu/modifier CRUD, `server/routes/admin.js`, `AdminPage.jsx` item/category/modifier forms.

   **Problem to reproduce:** Item writes commit before modifier-link replacement. The link operation has its own transaction, which does not protect the preceding item write. Several UI handlers log errors without useful operator feedback.

   **Bounded scope:** Combine each item-plus-link operation in one short database transaction. Validate referenced records and use database constraints as the final safeguard. Define concurrent edit behavior, using a small version check where necessary to prevent silent loss. Return meaningful not-found/conflict errors. Keep failed forms open with their input intact.

   Treat uploaded storage objects separately from SQL transactions. Do not delete a previous image before the new record commits; verify bucket/origin ownership before any cleanup. Handle orphan cleanup as a bounded, reviewable operation.

   **Dependencies:** WP06; WP22 for rollback/concurrency evidence.

   **Acceptance:** Positive—create/edit item, image, availability, and links persist together. Negative—invalid/deleted group or injected link failure rolls back all item changes; concurrent stale edit does not silently overwrite; failed upload/save/delete remains visible and retryable.

   **Astra checklist:** One transaction across the intended unit, short lock duration, storage/DB failure boundaries, referential integrity, and no unscoped deletion.

   **Completion/blocked evidence:** Real database rollback and concurrent-edit results, authenticated admin browser evidence, and diff. Mocked rollback alone cannot close this package.

8. **WP08 — Correct paid-order reporting semantics**  
   **Priority/applicability:** P1, Both.

   **Sources:** `database.js` `getOrderStats`, `getTodayRevenue`, date filters; admin reporting routes; `AdminPage.jsx` overview/history.

   **Problem to reproduce:** Revenue includes non-cancelled pending/failed/unpaid orders. Fulfillment status and payment status are conflated.

   **Bounded scope:** Report integer-cent totals for recorded paid orders separately from pending, authorized, failed, refunded, and legacy unpaid cash orders. Label whether tax is included. Keep fulfillment counts separate.

   A low-risk initial date definition is “paid order total for orders created during the selected Pacific dates,” explicitly labelled. Do not call this settlement revenue or cash received during that period. Paid-but-cancelled anomalies must remain financially visible and flagged; fulfillment status must not silently erase recorded payment.

   **Dependencies:** WP03/WP05; serialize DB/Admin changes.

   **Acceptance:** Positive—synthetic mixed-state totals match exact expected cents and Pacific date boundaries. Negative—authorized/pending/failed/unpaid cash records cannot inflate paid totals; refunded records and anomalies are explicitly distinguished; multi-item joins cannot multiply revenue.

   **Astra checklist:** Labels match SQL, date interpretation is explicit, no invented payment/refund state, and pagination/filter totals agree.

   **Completion/blocked evidence:** Real isolated database aggregate tests and authenticated UI evidence. Provider reconciliation remains outside this package.

9. **WP09 — Enforce channel opening controls while preserving tracking**  
   **Priority/applicability:** P0, Both.

   **Sources:** `server/routes/orders.js`, admin public/settings routes, database settings, [client/src/App.jsx](/home/rokai/muzecafekitchen/client/src/App.jsx), closure configuration, API helpers, storefront/checkout/staff controls.

   **Problem to reproduce:** Build-time closure does not enforce the API boundary; `kitchen_open` affects both channels; missing/error states appear open. Closure hides confirmation routes.

   **Bounded scope:** Add explicit café and partner acceptance state with fail-closed defaults. Evaluate channel policy on the server before authorizing a new order/attempt. Keep café kitchen pause separate from partner preorder acceptance. Expose the server decision and reason to clients. Preserve existing-order tracking, recovery, cancellation/support, and staff access while ordering is paused.

   Serialize acceptance decisions and closing updates through an agreed database boundary so the closing behavior is defined under concurrent requests.

   **Dependencies:** WP06 contracts; coordinate WP10/WP11 route order and recovery semantics.

   **Acceptance:** Positive—all four café/partner open/closed combinations behave independently. Negative—direct authenticated POST cannot bypass closure; missing/malformed settings and status-fetch failure cannot imply open; customer cannot alter gates. Existing tracking/recovery remains reachable in each closed state.

   **Astra checklist:** Authorization, stale client cache, concurrent close/submit behavior, compatibility with `kitchen_open`, and no alternate API acceptance path.

   **Completion/blocked evidence:** HTTP matrix, isolated database race evidence, and closed/open browser routes. Neither channel opens merely because this code passes.

10. **WP10 — Enforce terminal replay and explicit cutoff policy**  
    **Priority/applicability:** P0, Both; cutoff-specific behavior P.

    **Sources:** `server/routes/orders.js` initial replay and unique-conflict recovery paths; `database.js` order/attempt/lifecycle functions; schedule helpers.

    **Problem to reproduce:** Existing-order reuse can reach checkout without checking terminal fulfillment. The concurrent-create recovery branch needs the same checks. Pending retries bypass current schedule validation.

    **Bounded scope:** Centralize the decision to return existing state, reject a new attempt, or resume an allowed attempt. Apply it to initial lookup and raced lookup. Completed, cancelled, and refunded orders may be viewed but cannot restart checkout. Preserve immutable order amounts and request identity.

    Authorize attempts in a short transaction with an order lock. Address cancellation racing an in-flight/unknown attempt without holding a database transaction open across provider I/O. Add a restrictive “reconciliation required/in progress” outcome where necessary; do not weaken refund safeguards.

    Separate cutoff restrictions on new attempts from read-only recovery. Record late paid-state evidence truthfully; do not drop it to make cutoff enforcement appear successful. Hold fulfillment requiring unresolved policy for review.

    **Dependencies:** WP05/WP09; shared contract with WP11; WP22 concurrency tests.

    **Acceptance:** Positive—valid same-payload recovery returns the existing identity; permissible pending retries reuse the existing attempt identity. Negative—terminal replay, changed-payload replay, raced terminal state, duplicate concurrent attempts, and cutoff equality/after-boundary attempts cannot initiate new provider work. Paid/authorized cancellation still returns the existing safeguard.

    **Astra checklist:** Both replay branches, lock/cancellation ordering, ambiguity handling, and no fake financial transitions.

    **Completion/blocked evidence:** Actual-route tests with mocked provider boundaries and real DB races. These establish lifecycle decisions, not provider correctness. Partner opening waits for the cutoff decision; paid launch waits for the separate workstream.

11. **WP11 — Add an ownership-bound checkout recovery protocol**  
    **Priority/applicability:** P0, Both.

    **Sources:** `server/routes/orders.js`, `database.js` idempotency lookup/creation, validators, proposed recovery tests.

    **Problem to reproduce:** A committed order whose response is lost has no client-known public ID. Repeating checkout currently couples discovery with provider/configuration and opening checks.

    **Bounded scope:** Add a protected, read-only recovery operation using the persisted checkout identity and verified customer subject. Register fixed recovery routes before `/:id`. Return a minimal recovery view; keys and UUIDs are locators, never authorization.

    Reuse the existing unique customer/idempotency relationship where sufficient. Introduce schema only if source/tests demonstrate a missing invariant. Keep “no order found yet” distinct from permission failure and network uncertainty. If creation may still be in flight, retry the original identity rather than allocate a new one.

    **Dependencies:** WP09/WP10; WP22 for actual uniqueness/ownership evidence.

    **Acceptance:** Positive—lost-response lookup discovers the original order; lookup works during ordering pause. Negative—another subject cannot discover it; changed requests conflict; concurrent lookup/create cannot lead to a replacement checkout identity; responses expose no internal payment metadata.

    **Astra checklist:** Enumeration resistance, fixed-route precedence, minimal response fields, ownership, and compatibility with provider-unavailable states.

    **Completion/blocked evidence:** Actual-route regressions, real DB uniqueness/ownership results, and documented client/server recovery states.

12. **WP12 — Persist customer checkout and cart correlation across browser failures**  
    **Priority/applicability:** P0, Both.

    **Sources:** `CheckoutPage.jsx`, `ConfirmationPage.jsx`, `MenuPage.jsx`, `PartnerMealsPage.jsx`, `CartContext.jsx`, `client/src/utils/api.js`, and a proposed small persistence adapter.

    **Problem to reproduce:** Refs lose checkout/attempt identity on reload; last-order storage occurs only after success; errors delete references; confirmation clears any cart in that channel. Partner recovery is absent.

    **Bounded scope:** Persist an immutable checkout snapshot before submission: verified subject binding, channel, cart identity/revision, request correlation, order idempotency key, attempt identity, state, and public ID when known. Never persist payment source tokens or card details.

    Use a browser transaction mechanism for cross-tab attempt allocation and cart correlation—proposed IndexedDB with a small adapter. Broadcast/storage notifications synchronize views; they are not locking. Clear a submitted cart only when its identity/revision still matches. Preserve newer cart and last-order records when viewing an older order.

    Add café and partner recovery UI. Distinguish network/5xx/429, expired identity, inaccessible/not-found, terminal, and pending outcomes. Refresh the existing session where possible; do not silently create a new anonymous identity to “recover” someone else’s order.

    **Dependencies:** WP02/WP11; serialize with tax/cart and form changes.

    **Acceptance:** Positive—reload before/during/after submission, lost response, provider-return navigation, tab takeover, and partner recovery retain the correct identity. Negative—two tabs cannot allocate separate attempts for one submitted revision; an old paid order cannot erase a new cart/reference; storage denial/corruption fails safely; session loss cannot reveal the former subject’s order.

    **Astra checklist:** Immutable submitted payload, atomic persistence, identity changes, reference retention, bounded retention beyond partner delivery, and clear uncertainty messaging.

    **Completion/blocked evidence:** Component tests and multi-tab browser evidence against actual application source; authenticated recovery acceptance when the isolated Supabase environment is available. Cross-device access remains a separate owner decision.

13. **WP13 — Persist notification and handoff intent with lifecycle changes**  
    **Priority/applicability:** P0, Both; handoff P.

    **Sources:** `database.js` payment/lifecycle transactions, `server/routes/orders.js`, [server/routes/webhooks.js](/home/rokai/muzecafekitchen/server/routes/webhooks.js), proposed migration and transaction tests.

    **Problem to reproduce:** Required work follows the paid-state transaction and depends on a transient `payment_transitioned_to_paid` flag. A crash can persist payment state without receipt/handoff intent. Ready/cancel sends are detached.

    **Bounded scope:** First approve a small Postgres-backed design for fit: server-only durable records, transactional inserts, bounded worker access, and modest indexes. Reuse existing handoff records where appropriate.

    Persist receipt intent inside the effective paid transition; ready/cancel intent inside their lifecycle transaction; reminder eligibility from an explicit ready event/time. Use unique event/type keys so replay cannot create duplicate intent. Make partner handoff creation transactional with its qualifying transition.

    Add an idempotent reconciliation path for missing required intent. Historical repair must use a reviewed eligibility window and evidence; do not indiscriminately resend old receipts.

    **Dependencies:** WP10 and contract agreement with WP17; exclusive DB/order-route ownership.

    **Acceptance:** Positive—committed transitions always have the required intent. Negative—transaction rollback leaves neither transition nor intent; duplicate route/webhook processing creates one logical intent; crash injection after commit does not lose work; terminal/ineligible partner orders do not enter handoff accidentally.

    **Astra checklist:** Transaction boundary, unique keys, payment-state monotonicity, RLS/grants, sensitive payload minimization, and backfill safety.

    **Completion/blocked evidence:** Real DB transaction/crash/replay results and migration review. Provider mocks cannot substitute for transactional evidence.

14. **WP14 — Implement bounded workers and honest SMTP outcomes**  
    **Priority/applicability:** P0, Both.

    **Sources:** [server/services/email.js](/home/rokai/muzecafekitchen/server/services/email.js), `pickupReminder.js`, durable work functions, and proposed worker tests.

    **Problem to reproduce:** Missing SMTP configuration resolves a failure object that reminders count as sent. Claiming a reminder sets its sent flag prematurely. Processing fans out over the full result set.

    **Bounded scope:** Standardize outcomes such as pending, leased, SMTP-accepted, retryable failure, blocked configuration, ambiguous outcome, suppressed, and exhausted/manual attention. Distinguish SMTP acceptance from delivery to an inbox.

    Claim bounded batches with short database transactions, retryable leases, attempt counters, next-attempt timestamps, and ownership/fencing tokens. Commit claims before network I/O. Bound connection/send time and concurrency; reserve time to persist results before invocation expiry. Recheck reminder relevance and suppress known collected/cancelled orders.

    Use backoff and bounded retries with visible exhausted work. Stable message IDs help diagnosis but do not guarantee SMTP deduplication. A crash after SMTP acceptance and before recording success can cause a duplicate; document that uncertainty and recovery policy.

    **Dependencies:** WP13; WP22 for two-worker tests.

    **Acceptance:** Positive—accepted recipients are counted correctly; temporary failures recover; expired leases become available. Negative—unconfigured sender, rejected recipient, timeout, crash, stale lease completion, duplicate workers, and already-collected reminders cannot be falsely marked delivered or permanently lost.

    **Astra checklist:** No network calls under row locks, fencing, bounded lifetime, truthful status names, no PII in operational logs, and safe manual requeue.

    **Completion/blocked evidence:** Deterministic worker tests, controlled local SMTP results, and real DB lease/concurrency evidence. Actual release-email delivery remains a later authorized release check.

15. **WP15 — Add notification operations and supported scheduling**  
    **Priority/applicability:** P0, Both/Release.

    **Sources:** `server/app.js` Cron routes, `server/routes/admin.js`, `AdminPage.jsx`, [vercel.json](/home/rokai/muzecafekitchen/vercel.json), worker metrics.

    **Problem to reproduce:** Reminder endpoint exists but is unscheduled in source. Staff cannot see delivery failures or retry ownership. The function currently has `maxDuration: 30`.

    **Bounded scope:** Add authorized staff visibility for backlog age, failure reason, attempt state, and controlled retry. Record worker run start/completion, oldest eligible work, lease recovery, SMTP outcomes, and exhausted work.

    Add Vercel-compatible invocation only after verifying the actual plan’s Cron frequency, scheduling precision, and function-duration support against current official documentation and project settings. Set batch/time budgets below the verified limit. If the plan cannot meet the promised reminder latency, block that release gate and present supported alternatives; do not silently purchase infrastructure or assume minute-level scheduling.

    **Dependencies:** WP14/WP23; serialize `AdminPage.jsx` and `vercel.json`.

    **Acceptance:** Positive—authorized invocation drains a bounded batch and exposes honest metrics. Negative—missing/wrong Cron credentials and customer-triggered retries are denied; overlapping invocations remain safe; budget exhaustion leaves recoverable work; preview cannot send production mail.

    **Astra checklist:** Cron authentication, scheduler assumptions, PII minimization, retry permissions, and configuration health versus actual delivery health.

    **Completion/blocked evidence:** API/UI tests, worker budget measurements, supported scheduling specification, and—only after separate authorization—deployment-specific invocation and controlled inbox evidence.

16. **WP16 — Provide delivery-day pickup identity and packing lists**  
    **Priority/applicability:** P0, P.

    **Sources:** `database.js` pickup counters/order creation/active/history queries, order routes, `KitchenDisplay.jsx`, Admin history, proposed migration.

    **Problem to reproduce:** Pickup counters use creation date. Orders placed on different days for the same Monday can share a number. Kitchen requests default to café, and history lacks delivery/channel filters.

    **Bounded scope:** Allocate partner pickup identity from delivery date and enforce a clear namespace at the database level. Proposed display identifiers include channel and service date, with a sequence shared across partner orders for that day. Use Pacific service date for café.

    Preserve historical customer-facing numbers. Before enabling constraints, prepare collision detection and explicit legacy disambiguation; do not silently renumber receipts.

    Add staff-only channel/partner/delivery-date filters, item-quantity packing totals, order-level pickup detail, and existing preparing/ready/completed actions. Packing eligibility follows the approved payment/fulfillment policy.

    **Dependencies:** WP05/WP10/WP13; WP22; serialized DB/order/Kitchen/Admin changes.

    **Acceptance:** Positive—orders created on different days for one delivery day get unambiguous pickup identities and correct packing totals. Negative—concurrent allocation cannot duplicate identity; cancelled/ineligible orders cannot silently enter packing; wrong-day/channel records do not leak into totals; customers cannot access lists.

    **Astra checklist:** Counter/constraint agreement, legacy handling, filters, data minimization, and lifecycle safeguards.

    **Completion/blocked evidence:** Real allocation/concurrency tests, synthetic packing reconciliation, and authenticated staff browser flow. Partner stays closed without this evidence.

17. **WP17A — Implement the chosen partner handoff transport and acknowledgement state**  
    **Priority/applicability:** P0, P.

    **Sources:** `database.js` handoff functions, existing `partner_order_handoffs` schema, proposed staff routes and transport adapter.

    **Problem to reproduce:** Handoff rows exist, but there is no dispatch, acknowledgement, or retry processor.

    **Bounded scope:** Implement only the owner-selected transport. An agreed manual CSV/export process is acceptable; an API integration is not assumed. Separate pending, attempted/sent, acknowledged, failed, and manual-attention states. Record actor, timestamps, transport reference, and retry ownership.

    Reuse WP14 lease behavior for an automated transport if it fits. For manual processing, export creation alone must not mark sent or acknowledged. Minimize customer data and make CSV content safe for spreadsheet interpretation. Preserve the handoff idempotency key on retries.

    **Dependencies:** Owner transport/acknowledgement decision; WP13/WP14/WP16.

    **Acceptance:** Positive—one eligible order follows the chosen transport to a recorded acknowledgement. Negative—duplicate dispatch/ack, foreign order IDs, unauthenticated updates, transport failure, and crash cannot falsely acknowledge or lose the order.

    **Astra checklist:** Transport-specific evidence, data disclosure, retry semantics, distinction between transport and fulfillment, and no assumed partner settlement automation.

    **Completion/blocked evidence:** Local transport fixtures and real DB state/concurrency tests. External transport verification requires separate authorization and designated recipients.

18. **WP17B — Add partner handoff and retry UI**  
    **Priority/applicability:** P0, P.

    **Sources:** `KitchenDisplay.jsx` or a narrowly scoped partner operations component, staff API utilities, relevant Admin sections.

    **Problem to reproduce:** Staff cannot identify unacknowledged partner work or act on it.

    **Bounded scope:** Show delivery day, handoff state, age, reference, acknowledgement, retry owner, and failure details. Add role-appropriate export/record-sent/acknowledge/retry actions for the chosen transport. Link to packing and pickup operations. Keep existing fulfillment transitions separate.

    **Dependencies:** WP17A/WP16/WP02.

    **Acceptance:** Positive—staff can find and resolve pending/failed handoffs and complete pickup operations. Negative—failed requests remain visible; double-click/reload does not duplicate actions; stale state refreshes; customers and unauthorized roles cannot act.

    **Astra checklist:** Accurate state labels, confirmation for repeat external effects, accessible errors, and no implied acknowledgement.

    **Completion/blocked evidence:** Authenticated browser acceptance and operator runbook walkthrough using synthetic orders.

19. **WP18 — Serialize partner publication and enforce freshness**  
    **Priority/applicability:** P0, P.

    **Sources:** [server/services/partnerMenuImport.js](/home/rokai/muzecafekitchen/server/services/partnerMenuImport.js), `database.js` stage/publish functions, import routes/schema.

    **Problem to reproduce:** Publication locks only the selected run, allowing different runs for one partner to compete. It permits stale publication and falls back to a current-week date. An auto-publish path can bypass human review.

    **Bounded scope:** Lock a shared partner record before publication decisions, then re-read the run, reviewed revision, and publication watermark inside that transaction. Use consistent lock order for every publication/rollback path. Enforce freshness, one valid delivery schedule, candidate validity, and approved content hash/version before disabling the active menu.

    Reject ambiguous/missing schedules instead of inventing a week. Preserve last good menu on failed import/publication. Require an explicit reviewed rollback operation; ordinary stale publish must not act as rollback. Ensure all code paths, including configured auto-publish, respect review requirements.

    Keep source fetch allowlisting, redirect restrictions, size limits, and bounded total request time. Account for the existing possible two-request fallback within the invocation budget.

    **Dependencies:** WP05/WP06; review contract with WP19; WP22.

    **Acceptance:** Positive—fresh reviewed import atomically replaces the selected partner’s menu. Negative—two connections publishing different runs cannot produce mixed menus or regress to an older run; stale review, missing schedule, expired cutoff, and mid-transaction failure leave the active menu intact. Different partners can publish independently.

    **Astra checklist:** Lock the partner, not merely the run; freshness checked after lock acquisition; rollback is auditable; every publication path is covered; fetching remains constrained.

    **Completion/blocked evidence:** Barrier-controlled real DB races and rollback tests. Promise concurrency against mocks is not sufficient.

20. **WP19 — Make source schedule and allergens reviewable; resolve catalog ambiguity**  
    **Priority/applicability:** P0 for partner publication; P1 catalog clarity.

    **Sources:** `AdminPage.jsx` import review, import APIs/candidate payloads, `PartnerMealsPage.jsx`, allergen components, café catalog administration.

    **Problem to reproduce:** Candidate review omits schedule/allergen fields used by publication. Publication can be requested without reviewing the exact content. The audit observed duplicate “Blue Hawaiian” entries, but their current state and intended meaning are unverified.

    **Bounded scope:** Display source URL/hash, fetch/source dates, original cutoff, interpreted Pacific cutoff, delivery date, full descriptions, price/tax treatment, and allergen information. Distinguish inferred allergens from partner-confirmed information; empty tags must not imply allergen-free. Bind approval to the reviewed revision so changes invalidate it.

    Prepare a catalog comparison for the duplicate-name finding when authorized data access exists. Document intentional variants or propose a precise owner-approved disable/merge; no guessed deletion or price change.

    **Dependencies:** WP18/WP04; serialize Admin changes.

    **Acceptance:** Positive—review displays exactly what publication consumes. Negative—stale/missing review cannot publish, schedule/allergen changes require review again, and customer copy cannot imply confirmed safety from inference.

    **Astra checklist:** Server enforcement of reviewed revision, truthful allergy copy, price-copy consistency, and bounded catalog changes.

    **Completion/blocked evidence:** API/component tests and authenticated review/publish browser evidence. Catalog duplication remains an observation until verified, not an automatic launch blocker.

21. **WP20 — Complete customer routing, form behavior, and accessibility**  
    **Priority/applicability:** P1 for checkout accessibility; P2 secondary polish, Both.

    **Sources:** `App.jsx`, `CheckoutPage.jsx`, `ItemModal.jsx`, `CancelReasonModal.jsx`, Admin dialogs, cart drawer, and proposed not-found component.

    **Problem to reproduce:** Open-site unknown routes render no page. Checkout inputs lack programmatic labels, and the sticky button bypasses native form submission/validation.

    **Bounded scope:** Add a useful catch-all route while preserving API 404 behavior and closed-site tracking. Connect the sticky CTA to the actual form; support Enter submission, associated labels, field errors, and accessible loading/error announcements.

    Review touched dialogs for name/role, keyboard focus containment, Escape behavior where appropriate, focus return, and failed-action recovery. Avoid an unrelated visual redesign.

    **Dependencies:** WP02/WP09/WP12; serialize overlapping route/form/dialog work.

    **Acceptance:** Positive—unknown routes offer navigation; keyboard and pointer submission use one validated path; dialogs restore focus. Negative—invalid email cannot initiate checkout; repeated activation does not duplicate submission; loading/failure cannot trap focus or silently close a failed form.

    **Astra checklist:** Native semantics, focus behavior, screen-reader labels, mobile layout, and preservation of payment safeguards.

    **Completion/blocked evidence:** Component/browser regressions plus manual keyboard acceptance. Automated accessibility checks supplement, rather than replace, the walkthrough.

22. **WP21 — Make abuse protection durable and shared-IP tolerant**  
    **Priority/applicability:** P0, Both.

    **Sources:** [server/middleware/rateLimit.js](/home/rokai/muzecafekitchen/server/middleware/rateLimit.js), order middleware sequence, `server/app.js` proxy configuration, proposed private counter storage.

    **Problem to reproduce:** Five unauthenticated attempts consume the shared IP order quota; the sixth returns 429. In-memory counters are instance-local.

    **Bounded scope:** Retain a broad pre-authentication IP safeguard and use durable, authenticated subject-aware limits for new orders. Give valid owned idempotent recovery a separately bounded allowance so it does not consume another new-order quota. Arbitrary keys or mismatched payloads must not bypass protection.

    Evaluate a small atomic Postgres counter store with expiry/cleanup; avoid Redis or a paid service. Both application-level pre-authentication IP counters and authenticated subject/recovery counters must use shared atomic storage, not instance-local memory. Existing platform/edge abuse protection can remain a supplementary layer, not evidence that application counters are distributed. Verify trusted client-IP extraction for Vercel, including IPv6 normalization and forwarded-header spoofing. Define fail-closed mutation behavior when durable limit enforcement fails.

    **Dependencies:** WP09/WP10/WP11; WP22; serialized order-route changes.

    **Acceptance:** Positive—at least twenty distinct synthetic customers behind one NAT can perform the approved normal ordering/retry scenario. Negative—one subject flooding new keys is limited; forged forwarding headers do not evade limits; repeated owned recovery remains bounded; two API instances enforce the same counters.

    **Astra checklist:** Auth ordering, recovery exemption proof, counter atomicity, retention, database cost, and honest `Retry-After` behavior.

    **Completion/blocked evidence:** Real shared-store/two-instance load results and actual HTTP boundary tests. Do not choose final thresholds solely from the twenty-user fixture; record the supported office burst assumptions.

23. **WP22 — Verify real database, RLS, identity, Realtime, and concurrency behavior**  
    **Priority/applicability:** P0, Both/Release.

    **Sources:** [supabase/tests/database/security.test.sql](/home/rokai/muzecafekitchen/supabase/tests/database/security.test.sql), migrations, DB functions, server auth middleware, Supabase clients, kitchen subscription.

    **Problem to reproduce:** Existing pgTAP primarily checks objects/grants. Real database execution, two-customer isolation, authenticated Realtime, and concurrent lifecycle behavior were not verified.

    **Bounded scope:** Build synthetic tests incrementally alongside each relevant package. Preserve every historical migration present at the base revision, including any already deployed migration: do not edit, delete, reorder, or rewrite those files to implement a correction or make tests pass. Author schema corrections only as new, narrowly allowlisted forward migrations. Stop and escalate unexplained hosted drift or a historical migration failure; neither authorizes rewriting history. Required database acceptance includes both complete unchanged-history-plus-new-migrations installation into an empty disposable database and an upgrade from the unchanged base schema to the candidate. Use the actual postgres driver for transaction tests and actual Supabase Auth/Data API/Realtime for their respective boundaries.

    The environment must be verified disposable, isolated, and explicitly permitted. A loopback URL alone is insufficient proof if it could be a tunnel. Do not use production exports or credential discovery. Docker permission denial does not justify `sudo`, socket permission changes, group changes, or a newly provisioned hosted substitute.

    **Dependencies:** WP01/WP02 and a permitted safe environment. No such environment has been established in this turn.

    **Acceptance:** Positive—customer A sees A’s own order/items; customer B sees B’s; staff accesses kitchen; admin accesses administration; private kitchen Broadcast and polling work. Negative—cross-customer reads, unauthenticated reads, direct customer mutations, staff admin writes, editable metadata role escalation, and access to payment/outbox internals are denied.

    Exercise expiry, token refresh, role removal, session revocation, existing subscriptions, and reconnect. Determine and enforce revocation behavior rather than assuming logout or stale JWT claims revoke access. Run the package-specific transaction, publication, pickup, lease, and rate-limit races with independent connections and controlled barriers.

    **Astra checklist:** Tests do not use a bypass role as customer evidence; SQL claims tests are distinguished from real JWT flows; exposed tables/functions/views have correct grants/RLS; no secret keys enter frontend artifacts.

    **Completion/blocked evidence:** Separate SQL, driver/concurrency, Auth/Data API, and Realtime/browser logs. Required tests remain **blocked**, not passed or green-with-skips, until the environment exists.

24. **WP23 — Add Vercel-compatible verification and environment boundaries**  
    **Priority/applicability:** P0, Release.

    **Sources:** Root/workspace manifests, lockfile, `api/index.js`, `vercel.json`, Vite configuration, and a **proposed** `.github/workflows/verify-vercel.yml`.

    **Problem to reproduce:** Recorded checks used Node 26; current hosted deployment identity, triggers, environment isolation, and scheduling constraints are unverified.

    **Bounded scope:** Add a verification-only CI workflow with Node 24, locked installation, offline regression tests, frontend build/lint, and separately gated real DB/browser jobs. Keep production secrets away from untrusted PR execution. Pin introduced tooling/actions appropriately. Do not edit historical Fly artifacts.

    Prepare a target matrix for local, isolated integration, Vercel preview, and production: Supabase target, public build configuration, server configuration, origins, auth redirects, closure/acceptance state, SMTP destination policy, and Cron behavior. Compare configuration names and target identities without logging secret values.

    Verify current official Vercel/Supabase guidance and actual plan limits before implementation of platform-dependent configuration. A preview build may contain preview Supabase settings baked into `VITE_*`; it must not be blindly promoted as a production artifact.

    **Dependencies and split acceptance:** WP01/WP02 enable offline CI/configuration implementation and its source-only acceptance; this first stage does not depend on WP15. WP15 may use that accepted runtime/environment contract to implement supported scheduling. WP23's separate final release-verification stage requires the applicable WP15 scheduling/notification evidence and WP22 real integration evidence. Do not interpret those final release checks as a circular implementation dependency or declare hosted release verified from an offline CI pass.

    **Acceptance:** Positive—verification runs on the deployment-compatible Node 24 runtime and identifies the exact source/artifact. Negative—a failing required check, wrong runtime, wrong environment target, fork-secret exposure, or unsupported Cron/duration assumption blocks release. Preview cannot mutate production services or send production communications.

    **Astra checklist:** Build-time versus runtime variables, immutable source identity, Git-trigger side effects, environment isolation, and absence of automatic live migrations.

    **Completion/blocked evidence:** CI/configuration diff and local results first; hosted trigger/environment evidence only after separate authorization. Workflow existence alone is not proof that release gates are enforced.

25. **WP24 — Prepare schema, restore, monitoring, release, and rollback runbooks**  
    **Priority/applicability:** P0, Release.

    **Sources:** Migration history, `server/routes/admin.js` managed-backup responses, health/Cron routes, `vercel.json`, and proposed operational documents.

    **Problem to reproduce:** Managed-backup responses do not prove retention or restore capability. Historical drift claims and hosted account/deployment claims need fresh verification.

    **Bounded scope:** Prepare reviewable procedures for:

    - Comparing hosted migration history and schema with source before any future migration; stop on unexplained divergence. Never blindly repair history or reapply migrations.
    - Expand-first schema changes, compatibility with the prior application, migration preconditions, and separately approved data backfills.
    - Verifying Supabase backup/restore capabilities and retention, plus storage-object/image recovery separately from database backup. Preserve legacy snapshots without modifying them.
    - Restoring into an isolated target, reconciling synthetic—and later explicitly authorized—record/image counts and invariants, and recording recovery objectives and measured results.
    - Verifying staff/admin access, reset/support procedures, and revocation using designated test accounts rather than private account inventories.
    - Monitoring order errors, API/database health, worker backlog age, notification failures, unacknowledged handoffs, and stale/failed imports, with named responders and runbook actions.
    - Releasing a known artifact with acceptance initially closed; verifying the final target; then requesting channel-specific opening approval.
    - Closing new acceptance during incidents while preserving tracking/support. Prefer compatible application rollback or a forward fix; database restore requires explicit handling of orders accepted after the restore point. Avoid simultaneous writes to old and new systems and prevent outbox replay from blindly resending completed work.

    **Dependencies by acceptance gate:** Offline runbook drafting may begin without waiting for partner implementation. Café release/recovery acceptance requires the café-applicable WP09–WP15 behavior, WP22 café/shared database/auth/Realtime/concurrency evidence, WP23 final environment/artifact verification, authenticated café/staff browser acceptance, and actual restore/monitoring/rollback evidence. Server-side partner ordering must remain verified closed. Inventory and explicitly handle every existing cron schedule during release/rollback even when partner ordering is disabled. Partner release additionally requires WP05 and WP16–WP19 (including WP17A/WP17B), their real database/operator evidence, and agreed partner transport/acknowledgement/cutoff policies. Missing partner-only features or decisions must not block the independently verified café gate. Any hosted verification or action still requires separate authorization.

    **Acceptance:** Positive—an isolated restore and rollback rehearsal recover data, images, identities, and durable work consistently. Negative—missing backup evidence, incompatible old code/new schema, unexplained drift, wrong target, lost recent orders, or duplicate side effects stops the procedure.

    **Astra checklist:** Executable steps, target verification, separate approvals, backup scope, observable success criteria, and recovery of post-cutover work.

    **Completion/blocked evidence:** Luna-authored runbooks, review record, restore/rehearsal results, and eventual approved release evidence. A dashboard link or health response is insufficient.

**Test strategy and evidence rules**

Use **RED → GREEN → REFACTOR for each behavior**, against actual source:

1. Luna writes the regression first and records the intended failing assertion on the pre-fix behavior.
2. Luna makes the smallest implementation change.
3. Run the focused regression, then appropriate related checks.
4. Refactor only while preserving those tests.
5. Astra independently checks that the failure addressed the real defect and that the assertions would detect recurrence.

If source disproves an audit finding, stop the proposed behavior change. Record the inspected source, precise test, observed behavior, and corrected evidence classification. Add a useful characterization test where appropriate; do not manufacture a failure or change correct behavior to fit the audit.

Use deterministic clocks for cutoff, DST, expiry, leases, backoff, and reporting. Use explicit synthetic fixtures for menu, two customers, staff/admin, partner source HTML, SMTP, and provider boundaries. A live public-menu proxy is not an offline fixture or authenticated end-to-end evidence.

Mocks protect hosted/provider boundaries. They do not prove database transaction rollback, distributed counters, publication serialization, RLS, or Realtime authorization.

Existing commands verified historically by the audit:

| Command | Recorded result | Required next treatment |
|---|---|---|
| `npm test` | 20 server tests passed on Node 26 | Run only after WP01 isolation, on Node 24. |
| `npm run build` | Passed on Node 26 | Rebuild with explicit safe Vite configuration on Node 24. |
| `npm run lint -w client` | Passed on Node 26 | Repeat on the reviewed implementation. |
| `npm audit --omit=dev --json` | No known vulnerabilities then | Refresh when registry access is permitted. |
| `npm audit --json` | No known vulnerabilities then | Include newly introduced test/tool dependencies. |

Proposed script names—**not existing commands until Luna implements and Astra reviews them**—are `verify:offline`, `test:client`, `test:api`, `test:db`, and `test:e2e`.

The launcher should record the actual child runtime; selecting mise in the parent shell alone is insufficient. Locked dependency installation belongs only in the assigned workspace. Never search for production credentials to make tests pass.

Required test failures and unavailable infrastructure must be reported distinctly. A skipped required database/browser suite cannot produce an accepted package or green release gate.

**Dispatch-ready first batch — briefs only; do not dispatch this turn**

**Brief A: WP01, isolated baseline bootstrap**

- **Process:** Luna Max, with verified startup model/effort.
- **Base:** `cf42f3a986c62ae7c9b8f6e695eb01ab1e5601a5` in an authorized isolated workspace.
- **Allowed changes:** New local verification-support files, minimal root test-launcher wiring, and a narrowly scoped artifact-ignore entry if needed. No application logic, SQL, deployment configuration, or owner-document edits.
- **Required sequence:** Inspect import/script side effects; build isolation checks using synthetic sentinels; demonstrate rejection of unsafe targets; install locked dependencies safely if needed; run the existing baseline under Node 24.11.1.
- **Stop conditions:** Ambient configuration cannot be excluded, runtime mismatch, unexpected network destination, installation requires unreviewed lifecycle execution, or requested model/effort cannot be verified.
- **Return:** Exact allowed-file diff, runtime/startup logs, actual commands and exit codes, isolation checks, baseline counts including skips, and unresolved blockers.

**Brief B: WP03, pure tax correctness**

Run after Brief A is accepted. This is deliberately smaller than the full settings/checkout work.

**Allowed files:**

- `server/services/orderPricing.js`
- `server/services/orderPricing.test.js`
- `client/src/utils/pricing.js`
- A proposed pure shared money module and focused Node tests for it/client pricing

Do not edit `database.js`, routes, Admin UI, settings, payment code, SQL, manifests, or deployment configuration. Ask Astra for a scoped brief revision if an additional file is necessary.

Use explicitly labelled synthetic rates; none establishes the business’s legal rate.

| Regression | Expected result |
|---|---|
| Café subtotal `10000` cents, rate `"0.0835"` | Tax `835`, total `10835`. |
| Same subtotal, legacy `"0.08349999999999999"` | Same result through the explicitly bounded compatibility path. |
| Café subtotals `1`, `2`, `3` cents at `"0.25"` | Taxes `0`, `1`, `1` cents. |
| Café subtotal `1` cent at `"0.5"` | Tax `1` cent under documented half-up rounding. |
| Partner listed total `2059` cents at `"0.08375"` | Subtotal `1900`, tax `159`, total `2059`. |
| Partner quantity three, listed total `6177` cents | Subtotal `5700`, tax `477`, total `6177`. |
| Zero basket; rates zero and one | Exact documented integer results; no nonfinite values. |
| Valid quantities and modifiers | Server cents and browser calculation agree; submitted prices remain ignored. |
| Blank/missing, malformed, negative, above-one, exponent/percent text where unsupported | Explicit validation/configuration failure; no substituted rate. |
| Material extra precision such as `"0.0835004"` | Rejected, not silently normalized to `"0.0835"`. |
| Amount/output exceeds supported integer/storage bounds | Explicit error, not overflow or precision loss. |
| Explicit café/partner fixtures and wrong-channel item | Correct channel succeeds; mismatch remains rejected. |

The first RED must show the known float-artifact mismatch using actual exported pricing functions. Supplementary failures should independently expose invalid-rate fallback and rounding requirements.

Do not widen legacy normalization until tests demonstrate its exact accepted range. Leave canonical settings writes, public API fallback removal, and cart integration to WP04.

**Evidence handoff for both briefs**

Proposed artifact location: `<assigned-worktree>/.artifacts/<package-id>/`. The launcher, logs, and tests are written by Luna; Astra returns review findings without editing them.

Each handoff must identify:

- Base revision and reviewed workspace/diff identity.
- Effective model/effort startup evidence.
- Actual command, working directory, Node executable/version, exit code, and log path.
- Failing-before and passing-after assertions.
- Changed-file diff and explanation tied to the acceptance criteria.
- Tests not run, why, and which acceptance claims therefore remain blocked.
- Known risks and any source evidence that contradicts the audit.

“All done” is not an acceptable handoff.

**Dependency order and channel gates**

Begin with WP01, then the narrow WP03 correctness slice. WP02 may proceed separately only after manifests/lockfile ownership is resolved and its files are independent.

Continue with tax integration, dates, admin contracts/atomicity, and reporting. Establish server opening controls and replay/recovery contracts before client recovery. Add transactional intent before workers and operations UI. Build partner pickup, handoff, and publication safeguards behind the closed partner gate. Add distributed rate limits after the recovery semantics are stable.

Write relevant real-DB tests with each package; execute them as soon as a permitted environment exists. Do not defer discovering concurrency requirements until the release review. CI and runbook drafting can proceed independently, but their acceptance requires the accumulated evidence.

| Gate | Evidence required |
|---|---|
| **Café non-payment readiness** | Accepted café-applicable correctness, opening, lifecycle/recovery, notification, rate-limit, admin/reporting, and checkout accessibility packages; Node 24 checks; real DB/RLS and authenticated staff/customer acceptance; release/restore evidence; confirmed café policy. |
| **Partner non-payment readiness** | Shared gate evidence plus real DATE/cutoff tests, agreed cutoff/recovery policy, delivery-day pickup/packing, chosen transport and acknowledgement ownership, handoff recovery, serialized reviewed publication, and confirmed partner pricing/allergen presentation. |
| **Paid launch** | Applicable readiness gate **and** the separately completed provider/refund/reconciliation workstream. This plan cannot clear that dependency. |
| **Production opening** | Owner approval of the specific production artifact/configuration/schema plan and selected channel, following final-target verification. |

A café-only release is a possible scope choice. It is not declared safe by this plan. It requires its own evidence and a verified server-side partner gate that remains closed.

**Definition of done and review procedure**

For each package:

- Luna’s implementation matches the approved behavior and allowed files.
- A fresh-context Astra process reviews both specification compliance and security/logic, inspecting source and diff independently of Luna’s explanation.
- Relevant RED/GREEN evidence exists; Node 24 checks pass; frontend build/lint and new coverage pass where applicable.
- Real database evidence exists for transactional, concurrency, SQL-type, grant, or RLS claims.
- Authenticated browser acceptance exists for affected customer/staff flows where relevant.
- No blocker remains for the acceptance claim. Work awaiting required infrastructure is a candidate with blocked verification, not accepted implementation.
- Secrets/dependency review is complete; logs/artifacts contain no credentials or private operational data; diff is scoped and owner files remain preserved.
- External provider correctness is never inferred from fixtures.
- No broad `git add`, silent commit/push, automatic live migration, or unapproved deployment occurs.

An independent Astra reviewer may execute existing, reviewed, safe verification commands against the candidate snapshot. Astra may not author tests, tooling, code, SQL, or correction edits.

Allow at most **two Luna correction-and-Astra re-review cycles** after the initial review. If blockers persist, stop the package and its dependent acceptance, summarize the unresolved invariant, and escalate for a revised brief. Only Luna performs corrections.

**Audit traceability**

| Original audit section | Evidence classification retained | Plan coverage |
|---|---|---|
| 1. Tax normalization | Reproduced in prior audit; source corroborated | WP03–WP04 |
| 2. PostgreSQL DATE | Reproduced offline with driver; real DB checkout unverified | WP05, WP22 |
| 3. Notifications | Static lifecycle trace plus reproduced false-success result | WP13–WP15, WP24 |
| 4. Partner handoff/pickup | Static gaps; actual concurrency unverified | WP16, WP17A–WP17B, WP22 |
| 5. Recovery | Static customer/server flow findings | WP10–WP12, WP20 |
| 6. Opening controls | Static mismatch; historical public observation | WP09, WP11, WP23 |
| 7. Admin CRUD/images | Image stripping reproduced; remaining paths static | WP06–WP07 |
| 8. Rate limiting | Shared-IP exhaustion reproduced; distributed behavior unverified | WP21–WP22 |
| 9. Reporting/publication/catalog | Static logic; historical duplicate-menu observation | WP08, WP18–WP19 |
| 10. Release/access/recovery | Verification gaps, not proof hosted setup is absent | WP01–WP02, WP15, WP22–WP24 |
| 10. Fly recommendation | **Superseded by user; entirely out of scope** | No work item |
| 11. UX/accessibility | Blank route reproduced; form issues static; full accessibility unverified | WP20, coordinated with WP09/WP12 |
| Lifecycle caveats | Terminal replay/cutoff gaps; existing refund safeguards retained | WP10–WP13; separate paid-launch dependency |

---

# Execution evidence and model controls

# Muze execution and evidence controls

## Verified model invocations

The installed Codex catalog supports both requested model/effort pairs. Actual isolated process startup logs confirmed:

| Role | Model | Reasoning | Sandbox for planning | Evidence |
| --- | --- | --- | --- | --- |
| Plan author | `gpt-6-astra` | `xhigh` | `read-only` | `astra-plan.log`, startup lines 1–10 |
| Implementation availability handshake | `gpt-5.6-luna` | `max` | `read-only` | `luna-availability.log`, startup lines 1–10 |

Codex CLI version: `0.153.3`. Luna returned the requested availability acknowledgement without tools or code changes; this is NOT implementation or test evidence. The plan author is still subject to independent Astra Xhigh review.

These invocations explicitly used `--ignore-user-config` and selected model/effort on the command line, avoiding the default reasoning setting and unrelated MCP integrations. No global Hermes or Codex settings changed. For eventual code work, select `workspace-write` within a separately scoped worktree and retain all task boundaries; an inability to use the normal sandbox is a blocker to resolve, not authorization to disable isolation or administer shared services.

## Separation of duties

- **Luna Max:** all application code, tests, SQL/migrations, CI/tooling/config edits, and corrections. Use a failing regression before each behavioral fix. Implementation briefs define allowed files and a scope-expansion gate.
- **Astra Xhigh:** requirements, sequencing, architecture and interface decisions, guidance documents, read-only specification/security/logic review, and acceptance. Astra does not patch code after review; it sends concrete findings back to Luna. Existing reviewed safe test commands can be used for independent verification; test changes still go to Luna.
- **Owner:** business policies, launch channels, consent for commits/pushes/PRs, production deployment, migrations, paid services, live identities, sends and transactions. A reviewed plan is not production approval.

## Evidence requirements per package

Preserve outside `/tmp`: actual worker startup metadata, worktree and base SHA, scoped diff, root-cause reproduction, RED/GREEN commands and outputs, Node version, negative/failure-path evidence, security and dependency findings, two-stage Astra verdict, and any remaining BLOCKED gates. Read the exact artifacts and diff; a worker's successful final message is not acceptance.

For database work distinguish unit/driver fixtures from actual PostgreSQL transaction/RLS/concurrency evidence. Missing Docker permissions remain unresolved; no sudo, group/daemon/cluster changes, PID/socket deletion, or hosted fallback is authorized. Do not read or copy live environment files into worktrees. For UI work use local fixtures or an explicitly permitted test deployment and test accounts; no accidental real orders.

## Repository and deployment scope

Repository: `/home/rokai/muzecafekitchen`; planned base `migration/vercel-supabase` at `cf42f3a986c62ae7c9b8f6e695eb01ab1e5601a5`. Recheck status before implementation and preserve existing reports/owner edits. Local Node `24.11.1` is available via `mise`; baseline project checks have NOT been rerun on that version during planning.

Vercel/Supabase only. Fly.io is ignored, including cleanup of legacy files. Square-payment addition and Stripe-backend implementation remain excluded. Do not publish claims of paid-order launch readiness until that separate workstream and its refund/reconciliation gate are accepted.

