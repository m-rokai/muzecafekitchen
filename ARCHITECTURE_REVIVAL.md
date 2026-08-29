# Revival core architecture

This branch keeps the existing Vite + Express + SQLite/Fly deployment shape
while establishing a boundary that can move to Cloudflare and a managed
identity provider later. No payment provider or Cloudflare deployment is
activated by this slice.

## Request and identity boundary

Customer order creation, viewing, and cancellation require a verified
upstream subject. The server maps that opaque subject to `customers.id`; it
does not treat a name, email address, browser-supplied customer id, or numeric
order id as authentication. Production defaults to `CUSTOMER_AUTH_MODE=required`
and therefore returns a configuration/authentication error until the future
gateway is wired.

For local development and tests only, set `NODE_ENV=development` (or `test`)
and `CUSTOMER_AUTH_MODE=dev-header`; send `X-Dev-Customer-Subject`. This mode is
rejected in production. A future Cloudflare Access/OIDC gateway should set
`CUSTOMER_AUTH_MODE=trusted-proxy`, strip inbound identity headers, validate the
upstream token, and inject `X-Verified-Subject` plus the shared
`X-Auth-Proxy-Secret`.

Staff continues to use the existing PIN/JWT surface. `JWT_SECRET` is required
and must be at least 32 characters in production; development/test processes
use an ephemeral process-local secret when one is not supplied. `requireAuth`
accepts only `admin` or `staff` JWT roles. A fresh local/test install may set
`INITIAL_ADMIN_PIN` as a temporary bootstrap credential; there is no default
PIN and that environment bootstrap is rejected in production. The `/api/admin`
configuration, destructive, backup, and history routes additionally require
the `admin` role via `requireAdmin`; `/api/orders/kitchen-status`,
`/api/orders/active`, and staff lifecycle operations remain available to either
staff role.

Socket connections are staff-only: a valid, unexpired staff JWT is required,
and the server disconnects the socket when its JWT expires. Customers do not
receive global order events; the confirmation page polls the ownership-checked
HTTP endpoint. Full order payloads are emitted only to the authenticated
`staff` room.

In production, Cloudflare Access/OIDC (or another trusted edge) is the intended
replacement for the temporary development identity header. The edge must
validate the upstream token, remove any inbound `X-Verified-Subject` and
`X-Dev-Customer-Subject` headers, inject the validated subject as
`X-Verified-Subject`, and add the shared `X-Auth-Proxy-Secret`. Configure
`CUSTOMER_AUTH_MODE=trusted-proxy` and `CUSTOMER_AUTH_PROXY_SECRET` at the
origin, or install an equivalent `customerAuthResolver`. Until that boundary
exists, production customer order routes fail closed with
`CUSTOMER_AUTH_NOT_CONFIGURED`.

Production CORS is fail-closed for cross-origin browser requests. Set
`CORS_ALLOWED_ORIGINS` (comma-separated exact HTTPS origins; `CLIENT_URL` is
also accepted for compatibility) for the deployed client. Requests without an
`Origin` are still usable for same-origin/non-browser calls, while malformed or
unlisted origins receive no CORS access.

## Order and data boundary

`server/db/migrations.js` is the only schema/data migration entry point. The
runner records ordered migrations in `schema_migrations` and upgrades the
existing Fly volume in place. Migration 1 contains a frozen baseline snapshot;
the readable `schema.sql` reference cannot silently alter an already-defined
migration. Upgrade migrations backfill valid unique public UUIDs and enforce a
unique public-id index. Money is calculated and persisted in integer `*_cents`
columns; decimal columns remain compatibility projections for the current
client/admin/email surfaces. Public order identifiers are UUIDs while the
numeric SQLite row id remains private.

Each customer/order pair has a unique idempotency key. The server stores a
canonical request hash and returns the original public id/pickup number on an
exact replay; a different payload with the same key returns a conflict. Order,
line items, modifiers, and the initial lifecycle event are inserted in one
SQLite transaction. Product availability, item-to-modifier links, modifier
availability, and group cardinality are checked against the current menu.

## Payments and lifecycle

Orders begin with `payment_status=unpaid` and explicit `payment_method=cash`
for the legacy cash checkout path. That explicit cash combination remains
fulfillment-eligible; `awaiting`/provider-unpaid states are not. Lifecycle
transitions are monotonic (`pending -> preparing -> ready -> completed`) and
cancel is terminal. Lifecycle events and the provider-neutral `payments` table
are ready for Square or Stripe. The adapter surface in
`server/services/payments.js` intentionally makes no live calls. Provider
credentials, webhook verification, capture/refund semantics, and payment
activation are future work.

SQLite backups use the online backup API against `DATABASE_PATH`, verify
integrity before and after the operation, and never copy the live database
file with `fs.copyFileSync`. The generated backup artifact should be copied to
an external encrypted/object-storage location by an operator or deployment
job; do not copy the live `.db`, WAL, or SHM files directly. Keep at least one
external backup before restore/cleanup operations.

## Future branch/deployment shape

Prospective Cloudflare work should preserve this domain boundary behind an API
worker/service and move durable state to a managed SQL store. A prospect branch
may add an OIDC verifier and provider adapters, but should not bypass
`customer_id` ownership checks or reintroduce numeric ids to customer routes.
Fly remains the active deployment target for this branch.
