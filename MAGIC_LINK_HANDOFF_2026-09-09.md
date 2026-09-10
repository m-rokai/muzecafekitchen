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

Local implementation and regression verification are complete. The next step is
deployment to the linked `muzecafe-kitchen-stage` project, followed by the single
authorized Supabase magic-link request. Record the deployment and actual send
result here. Inbox receipt and clicking the link require the owner's confirmation.
Do not send additional emails without authorization.
