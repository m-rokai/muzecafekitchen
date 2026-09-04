# Vercel + Supabase migration

This branch replaces the Fly.io/SQLite runtime with a Vercel-hosted Vite app and
stateless Express API backed by Supabase Postgres, Auth, Storage, and Realtime.

## Architecture

- Vercel serves `client/dist`; its zero-configuration Express detection bundles
  the root `index.js` export as one Function for `/api` routes.
- Supabase Auth issues anonymous customer sessions and email/password staff sessions.
- New orders use the authenticated Supabase user ID as `orders.customer_id`.
- The API uses a server-only Postgres pooler connection for atomic pricing and order writes.
- RLS protects every exposed table. Browser roles have no direct write grants.
- Menu images live in the public `menu-images` Storage bucket; only the server secret can write.
- A private Realtime Broadcast channel named `kitchen` replaces Socket.IO.
- Marking an order ready sends its pickup email immediately. The idempotent
  fallback reminder scanner remains available as an API endpoint, but its
  five-minute schedule requires Vercel Pro or migration to Supabase Cron.
- `/` is a storefront selector. Café and weekly partner meals use isolated carts;
  both are pickup-only and require a customer email.
- Café payments use Square Web Payments plus the Payments API. Partner-meal
  payments use Stripe Checkout. Provider webhooks, not browser redirects, are
  authoritative for fulfillment eligibility.
- Paid partner-meal orders enter a durable handoff outbox. The eventual handoff
  transport is deliberately pending the partner operating agreement.
- A secured weekly cron fetches the allowlisted partner menu URL. Imported
  candidates are staged for admin review and preserve the previous published
  menu on parsing or network failure.

## Local setup

Use Node 22 or newer and Docker.

1. Install dependencies with `npm install`.
2. Start Supabase with `npx supabase start`.
3. Copy `server/.env.example` to `server/.env` and `client/.env.example` to
   `client/.env.local`. Replace the placeholder keys with values from
   `npx supabase status`.
4. Reset the local schema with `npx supabase db reset`.
5. Seed a fresh menu with `npm run seed`.
6. Create an administrator by setting `STAFF_EMAIL`, `STAFF_PASSWORD`, and
   `STAFF_ROLE=admin` in `server/.env`, then run `npm run staff:create`.
7. Start the app with `npm run dev`.

Run database policy tests with `npx supabase test db`, server tests with
`npm test`, and the production client build with `npm run build`.

## Hosted Supabase setup

1. Create a Supabase project in the desired region.
2. Enable anonymous sign-ins. Keep email/password enabled for staff accounts.
3. Link the repository using `npx supabase link --project-ref <project-ref>`.
4. Review the migration, then apply it with `npx supabase db push`.
5. Use the transaction-mode Supabase pooler URL for `SUPABASE_DATABASE_URL`.
   The server disables prepared statements for pooler compatibility.
6. Set the hosted URL plus publishable and secret keys in the server environment.
   The secret key and database URL must never use a `VITE_` prefix.
7. Either seed an empty project or import the existing SQLite database; do not do both.

For a fresh database:

```bash
npm run seed
```

For an existing SQLite database and its adjacent `uploads/` directory:

```bash
npm run migrate:sqlite -- /absolute/path/to/muze_orders.db
```

The importer refuses a non-empty target, preserves numeric IDs and history,
uploads legacy menu images when found, and assigns historical orders to a
non-interactive archive identity. New customer ownership starts with Supabase Auth.

Create staff accounts through `npm run staff:create`. The script writes `staff`
or `admin` only to protected `app_metadata`; authorization never trusts editable
user metadata.

## Vercel setup

Import the GitHub repository as a Vercel project and keep the repository root as
the project root. Add these environment variables to Development, Preview, and
Production as appropriate:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_DATABASE_URL`
- `CLIENT_URL`
- `CRON_SECRET`
- `VITE_SQUARE_APPLICATION_ID`
- `VITE_SQUARE_LOCATION_ID`
- `VITE_SQUARE_ENVIRONMENT`
- `SQUARE_ENVIRONMENT`
- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PARTNER_MENU_URL`
- `PARTNER_MENU_ALLOWED_HOST`
- `PARTNER_SLUG`
- `PARTNER_NAME`
- email variables from `server/.env.example` if notifications are enabled

`CLIENT_URL` must be the exact production origin. Add the production and preview
origins to Supabase Auth redirect URLs. Generate `CRON_SECRET` with at least 32
random bytes; Vercel sends it as the cron Authorization bearer token.

Register `/api/webhooks/square` and `/api/webhooks/stripe` in the respective
provider dashboards. `SQUARE_WEBHOOK_URL` must exactly match the public Square
notification URL because it participates in signature verification. Keep all
provider secrets server-only; only Square's application ID and location ID are
published through `VITE_` variables.

The weekly import runs Monday at 16:00 UTC. `PARTNER_MENU_AUTO_PUBLISH` defaults
to `false`; keep it disabled until the source-specific parser has been verified
against multiple real menu revisions in Preview. Admin APIs can refresh, inspect,
and publish staged runs. The importer requires an exact hostname allowlist and
rejects redirects, private network addresses, non-HTTPS URLs, and responses over
2 MB.

The five-minute pickup-reminder fallback is not scheduled in `vercel.json`
because Vercel Hobby limits cron jobs to one invocation per day. Before a
production cutover, either upgrade the Vercel project or schedule
`/api/cron/pickup-reminders` through Supabase Cron with the same bearer secret.

## Pending business inputs

The code fails closed around the following unresolved operating decisions:

- partner menu URL and confirmation that automated retrieval is permitted;
- partner handoff transport (API, email, CSV, portal, or another mechanism);
- markup, taxes, order cutoff, pickup schedule, refunds, and chargebacks;
- manual partner settlement versus an automated Stripe Connect transfer.

Paid online orders cannot be cancelled until provider refunds are implemented
from the agreed policy. This prevents the application from marking a paid order
cancelled while leaving the charge in place.

## Cutover checklist

1. Put the existing ordering app into maintenance mode.
2. Take and verify a final SQLite backup and copy its uploads directory.
3. Apply the Supabase migration and run the importer.
4. Compare menu counts, order counts, totals, and a sample of order line items.
5. Verify admin sign-in, anonymous ownership, required-email checkout, Square and
   Stripe sandbox payments, signed webhook retries, kitchen Realtime updates,
   staged menu import/publish, image upload, and email delivery in Preview.
6. Move the production domain to Vercel.
7. Keep the Fly app and final SQLite backup intact but read-only until the new
   deployment has passed the agreed observation window.

Rollback means moving the domain back to the read-only Fly snapshot and reconciling
orders accepted after cutover. Do not write to both databases concurrently.
