begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

select has_table('public', 'orders', 'orders table exists');
select has_table('public', 'order_lifecycle_events', 'lifecycle audit table exists');
select has_table('public', 'payments', 'payments boundary exists');
select has_table('private', 'pickup_counters', 'pickup counters are private');
select has_table('public', 'partners', 'partners table exists');
select has_table('public', 'payment_webhook_events', 'payment webhook inbox exists');
select has_table('public', 'partner_menu_import_runs', 'partner menu import audit exists');
select has_table('public', 'partner_menu_import_candidates', 'partner menu staging exists');
select has_table('public', 'partner_order_handoffs', 'partner handoff outbox exists');
select has_column(
  'public',
  'payment_webhook_events',
  'last_attempt_at',
  'webhook inbox records retry leases'
);
select ok(
  to_regprocedure('private.broadcast_order_change()') is not null,
  'orders use a table-specific broadcast function'
);
select ok(
  to_regprocedure('private.broadcast_setting_change()') is not null,
  'settings use a table-specific broadcast function'
);
select ok(
  to_regprocedure('private.broadcast_kitchen_change()') is null,
  'unsafe shared broadcast function was removed'
);
select ok(
  not has_function_privilege('anon', 'public.rls_auto_enable()', 'execute'),
  'anonymous users cannot execute the platform RLS helper'
);
select ok(
  not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'execute'),
  'authenticated users cannot execute the platform RLS helper'
);

select ok((select relrowsecurity from pg_class where oid = 'public.categories'::regclass), 'categories has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.menu_items'::regclass), 'menu_items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.orders'::regclass), 'orders has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.order_items'::regclass), 'order_items has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payments'::regclass), 'payments has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.settings'::regclass), 'settings has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.partners'::regclass), 'partners has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_webhook_events'::regclass), 'webhook inbox has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.partner_menu_import_runs'::regclass), 'menu import audit has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.partner_menu_import_candidates'::regclass), 'menu staging has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.partner_order_handoffs'::regclass), 'partner handoff outbox has RLS');

select ok(has_table_privilege('anon', 'public.categories', 'select'), 'anonymous users can read categories');
select ok(has_table_privilege('anon', 'public.menu_items', 'select'), 'anonymous users can read available menu items');
select ok(not has_table_privilege('anon', 'public.orders', 'select'), 'anonymous users cannot read orders');
select ok(not has_table_privilege('anon', 'public.settings', 'select'), 'anonymous users cannot read settings directly');
select ok(not has_table_privilege('authenticated', 'public.orders', 'insert'), 'authenticated clients cannot insert orders directly');
select ok(not has_table_privilege('authenticated', 'public.orders', 'update'), 'authenticated clients cannot update orders directly');
select ok(not has_table_privilege('authenticated', 'public.payments', 'select'), 'payment records are server-only');
select ok(has_schema_privilege('anon', 'private', 'usage'), 'anonymous policy evaluation can call the explicit role helper');
select ok(not has_table_privilege('anon', 'public.partners', 'select'), 'partners are server-only');
select ok(not has_table_privilege('anon', 'public.payment_webhook_events', 'select'), 'webhook inbox is server-only');
select ok(not has_table_privilege('anon', 'public.partner_menu_import_runs', 'select'), 'menu import audit is server-only');
select ok(not has_table_privilege('anon', 'public.partner_menu_import_candidates', 'select'), 'menu staging is server-only');
select ok(not has_table_privilege('anon', 'public.partner_order_handoffs', 'select'), 'partner handoff outbox is server-only');

select * from finish();
rollback;
