# Muze Cafe Kitchen

Pickup ordering for Muze Café and weekly partner meals, with kitchen display and
menu administration built with Vite, React, Express, Vercel, and Supabase.

Café checkout is routed through Square; partner-meal checkout is routed through
Stripe. Both storefronts require email and use anonymous Supabase ownership
without requiring customers to create accounts.

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

Use Node 22 or newer. Configure the server and browser from the checked-in
`.env.example` files before seeding or starting the app.
