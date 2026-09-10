# Staff magic-link continuation checkpoint

Recovered September 9, 2026 after a desktop restart in
`/home/rokai/muzecafekitchen`, branch `migration/vercel-supabase`.

## Owner direction

Retain the café-only release and replace admin/kitchen passwords with email
magic links. Confirmed exact `@muzeoffice.com` addresses receive administrator
access. Use Muze Google Workspace SMTP. The owner saved a replacement app
password in Supabase and authorized one test sign-in email to
`robert.mai@muzeoffice.com` during this continuation.

## Recovered implementation

- Email-only sign-in UI, neutral sent message, rate-limit/error recovery, and a
  60-second resend cooldown based on elapsed time.
- Exact company-domain automatic account creation; other addresses must already
  have a staff account. Roles are still enforced by the API and database.
- `/auth/callback` handles implicit-flow sessions, expired/missing links, URL
  cleanup, and allowlisted admin/kitchen destinations, including during closure.
- Shared staff-access hook reacts to session events and verifies the current
  server role. Cross-tab login/logout works. Staff cannot enter admin.
- Local Supabase configuration requires email confirmation and allows callback
  URLs for localhost and 127.0.0.1 on port 5173.

The domain-admin database migration was already applied. A read-only query in
this continuation confirmed `auth.users` still has its enabled
`sync_muzeoffice_admin_role` trigger running with invoker permissions.

## Verification

- Node 24.11.1: all 18 existing server regressions passed.
- Client ESLint: passed.
- Production Vite build with isolated synthetic configuration: passed.
- 13 browser regressions passed using the real client and Supabase SDK with
  synthetic Auth/API responses. Covered company-domain normalization, external
  account creation restrictions, suspended-tab cooldown, 429/500 recovery,
  query/fragment link errors, off-site redirect rejection, fresh-browser login,
  cross-tab logout, admin restrictions, staff kitchen access, and customer denial.
- Desktop and 390 x 844 mobile sign-in screens reviewed; no overflow or page
  errors in the synthetic checks.
- `git diff --check`: passed.

These browser regressions did not send email or create live accounts.

## SMTP investigation correction

Hosted settings correctly identify `notifications@muzeoffice.com` on
`smtp.gmail.com:587`, with confirmations enabled and both exact callback URLs
configured. Management API password output matches a hexadecimal hash shape.
Direct SMTP checks using that output returned 535, but those checks were invalid
for judging the owner's saved app password. Do not ask the owner to rotate it
based on those results, or repeat direct SMTP authentication with the API value.

## Release and live verification

Implementation commit: `8a5a619` (`Use email magic links for cafe staff sign-in`).
Deployed successfully to the linked `muzecafe-kitchen-stage` project's production
target, with no environment changes:

- Stable URL: `https://muzecafe-kitchen-stage.vercel.app`.
- Deployment: `dpl_DLwLT4RfTc5Miu9vfygFwdN6CJG5`, status `READY`.
- Build URL: `https://muzecafe-kitchen-stage-3e3eb4mrv-mrokais-projects.vercel.app`.
- Hosted callback and email-only admin form verified in the browser.
- `/api/health` returned `status: ok` and `database: ok`.
- The one authorized email was requested through the **live admin form**, with
  Supabase's `/auth/v1/otp` returning HTTP 200 and the UI showing Check your inbox.
- No browser exceptions were recorded during the hosted callback and send flow.
- A subsequent scoped database check found the owner's email confirmed, a sign-in
  recorded, and the protected role set to `admin`.
- The owner confirmed **"its working"** after using the link, then requested the
  final commit and deployment at the end of the workday. Live email delivery and
  administrator sign-in are verified.

The prepared direct-send script failed before making any request because local
server configuration was absent; it was discarded. Only the live browser form
sent a real email. Do not send additional emails without authorization.

The health endpoint's `features.email.configured = false` describes the separate
order-notification service, not Supabase Auth SMTP. Square and order-notification
configuration remain separate launch work; the sign-in release does not resolve
them. The separate Luna worktree was not changed.

The final documentation commit records this successful live check; its deployment
uses the same verified application code. The stable URL above is the release
entry point. Local review browser and server processes are stopped at handoff.
