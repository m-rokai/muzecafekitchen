# Café-only continuation checkpoint

Reviewed September 9, 2026 in `/home/rokai/muzecafekitchen`.

## Current scope and workspace

The latest owner direction is to remove the Down to Earth Cuisine meal pickup
portal and retain Muze Café. The existing uncommitted implementation was resumed
and verified. No further application corrections were needed for the checks below.

Branch: `migration/vercel-supabase`. HEAD: `edafe0b` (the earlier documentation
checkpoint). Café-only application changes remain uncommitted. The separate
`muzecafekitchen-luna-foundation` worktree was not changed.

## Implemented behavior

- When ordering is enabled, `/` opens the café menu. `/partner-meals` and nested
  retired links redirect to `/cafe`.
- Café menu, customization, saved cart, Square checkout UI, admin catalog, and
  kitchen routes remain. The partner selector, pages, and admin import UI are removed.
- New partner orders and partner menu queries return `410 STOREFRONT_UNAVAILABLE`.
  Retired item IDs cannot be read or edited through the café catalog. Pricing also
  rejects a partner item submitted as a café order.
- Partner import routes, implementation, and Vercel cron configuration are removed.
- Historical orders, receipt formatting, stored data, and signed Stripe webhook
  reconciliation are retained. Existing closure configuration is retained.

## Verification completed

- Node **24.11.1**: **18 tests passed**, no failures or skips. Tests cover the real
  Express routing with synthetic database/auth fixtures, café catalog filtering,
  retired ordering/import rejection, pricing, and historical order access.
- `npm run lint -w client`: passed on Node 24.
- Vite production build: passed on Node 24 with `envDir: false`, synthetic browser
  configuration, and output in `/tmp/muze-cafe-review-dist`.
- Browser review: desktop café menu; 390 × 844 mobile customization, cart, and
  checkout; root and retired-link redirects; admin and kitchen sign-in screens.
  A $5.50 latte with $0.75 oat milk and instructions survived full navigation to
  the cart; cart and checkout both showed $6.25 subtotal, $0.52 tax, $6.77 total
  using the synthetic fixture's tax rate. No page errors or console errors recorded.
- `git diff --check`: passed.

Browser review used the built client and real Express routes with synthetic data
through a GET-only local API. It did not submit a payment, create an account, sign
in to hosted services, run database migrations, or verify live database/RLS behavior.
The checkout correctly showed missing Square configuration in this isolated review.

## Continuation

No commit, push, deployment, or hosted configuration change was made during this
continuation. The hosted site's source and current state were not rechecked.

The earlier completion audit and implementation plan describe the former
two-portal product. Partner launch packages are superseded by the café-only
direction. Shared café concerns in those documents, including tax normalization,
checkout recovery, notification reliability, and payment/release verification,
remain separate work; this checkpoint does not mark them resolved.
