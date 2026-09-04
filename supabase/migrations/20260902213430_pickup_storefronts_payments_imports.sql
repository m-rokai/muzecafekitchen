create type public.order_channel as enum ('cafe', 'partner_meal');
create type public.menu_import_status as enum (
  'running',
  'staged',
  'approved',
  'published',
  'failed'
);
create type public.partner_handoff_status as enum (
  'pending',
  'sent',
  'acknowledged',
  'failed',
  'cancelled'
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.categories
  add column channel public.order_channel not null default 'cafe';

alter table public.menu_items
  add column channel public.order_channel not null default 'cafe',
  add column partner_id uuid references public.partners(id) on delete restrict,
  add column external_source_id text,
  add column menu_week date,
  add column source_url text,
  add constraint menu_items_partner_shape check (
    (channel = 'cafe' and partner_id is null)
    or (channel = 'partner_meal' and partner_id is not null and external_source_id is not null)
  );

create unique index menu_items_partner_source_idx
  on public.menu_items(partner_id, external_source_id, menu_week)
  where channel = 'partner_meal';

alter table public.orders
  add column channel public.order_channel not null default 'cafe',
  add column partner_id uuid references public.partners(id) on delete restrict,
  add column pickup_window_start timestamptz,
  add column pickup_window_end timestamptz,
  add constraint orders_partner_shape check (
    (channel = 'cafe' and partner_id is null)
    or (channel = 'partner_meal' and partner_id is not null)
  ),
  add constraint orders_pickup_window_shape check (
    pickup_window_end is null
    or (pickup_window_start is not null and pickup_window_end > pickup_window_start)
  );

-- Historical imports may not contain an address. Preserve those records with
-- an explicitly non-deliverable archive value while requiring a valid email
-- for every new API-created order.
update public.orders
set email = 'legacy-order-' || public_id::text || '@invalid.local'
where email is null;

alter table public.orders
  alter column email set not null,
  add constraint orders_payment_route check (
    payment_method = 'cash'
    or (
      channel = 'cafe'
      and payment_method = 'square'
      and payment_provider = 'square'
    )
    or (
      channel = 'partner_meal'
      and payment_method = 'stripe'
      and payment_provider = 'stripe'
    )
  );

alter table public.payments
  add column idempotency_key text,
  add column provider_event_id text;

update public.payments
set idempotency_key = gen_random_uuid()::text
where idempotency_key is null;

alter table public.payments
  alter column idempotency_key set not null;

create unique index payments_provider_idempotency_idx
  on public.payments(provider, idempotency_key);

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  provider_event_id text not null,
  event_type text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'processing'
    check (processing_status in ('processing', 'processed', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  last_attempt_at timestamptz not null default now(),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create table public.partner_menu_import_runs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  source_url text not null,
  status public.menu_import_status not null default 'running',
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[0-9a-f]{64}$'),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  published_at timestamptz
);

create table public.partner_menu_import_candidates (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references public.partner_menu_import_runs(id) on delete cascade,
  external_source_id text not null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_url text,
  source_url text,
  source_payload jsonb not null default '{}'::jsonb,
  published_menu_item_id bigint references public.menu_items(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (import_run_id, external_source_id)
);

create table public.partner_order_handoffs (
  id uuid primary key default gen_random_uuid(),
  order_id bigint not null unique references public.orders(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete restrict,
  status public.partner_handoff_status not null default 'pending',
  idempotency_key uuid not null default gen_random_uuid() unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  handoff_reference text,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_channel_idx
  on public.menu_items(channel, available, menu_week, sort_order);
create index orders_channel_status_idx
  on public.orders(channel, status, created_at);
create index orders_partner_idx
  on public.orders(partner_id, created_at desc)
  where partner_id is not null;
create index payments_order_provider_idx
  on public.payments(order_id, provider, updated_at desc);
create index webhook_events_status_idx
  on public.payment_webhook_events(processing_status, received_at);
create index menu_import_runs_partner_idx
  on public.partner_menu_import_runs(partner_id, started_at desc);
create index menu_import_candidates_published_item_idx
  on public.partner_menu_import_candidates(published_menu_item_id)
  where published_menu_item_id is not null;
create index partner_handoffs_status_idx
  on public.partner_order_handoffs(status, created_at);
create index partner_handoffs_partner_idx
  on public.partner_order_handoffs(partner_id, created_at desc);

create trigger partners_set_updated_at
before update on public.partners
for each row execute function private.set_updated_at();

create trigger partner_handoffs_set_updated_at
before update on public.partner_order_handoffs
for each row execute function private.set_updated_at();

alter table public.partners enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.partner_menu_import_runs enable row level security;
alter table public.partner_menu_import_candidates enable row level security;
alter table public.partner_order_handoffs enable row level security;

-- These are server-managed tables. No browser role receives direct grants;
-- the API performs authorization and all writes using its database connection.
revoke all on public.partners from anon, authenticated;
revoke all on public.payment_webhook_events from anon, authenticated;
revoke all on public.partner_menu_import_runs from anon, authenticated;
revoke all on public.partner_menu_import_candidates from anon, authenticated;
revoke all on public.partner_order_handoffs from anon, authenticated;
