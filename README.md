# Muze Cafe Kitchen

Pickup ordering for Muze Café, with kitchen display and
menu administration built with Vite, React, Express, Vercel, and Supabase.

Café checkout uses Square, requires email, and uses anonymous Supabase ownership
without requiring customers to create accounts.

The Down to Earth Cuisine meal portal has been retired. The home page opens the
café menu; old `/partner-meals` links redirect there. New meal orders, meal menu
APIs, and menu imports are disabled. Historical database records and signed payment
webhook reconciliation remain available; this change does not delete data.

The Vercel configuration no longer schedules partner imports. These application
changes take effect on the hosted site when this version is deployed. Earlier
audit and implementation-plan documents describe the former two-portal scope.

The latest local verification and continuation notes are in
[the magic-link checkpoint](./MAGIC_LINK_HANDOFF_2026-09-09.md). Earlier café-only
verification is in [the café-only checkpoint](./CAFE_ONLY_HANDOFF_2026-09-09.md).

The active platform migration and setup instructions are in
[MIGRATION_VERCEL_SUPABASE.md](./MIGRATION_VERCEL_SUPABASE.md).

## Development

```bash
npm install
npx supabase start
npx supabase db reset
npm run seed
npm run dev
```

Use Node 24.x. Configure the server and browser from the checked-in
`.env.example` files before seeding or starting the app.
