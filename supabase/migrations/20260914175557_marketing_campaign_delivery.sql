-- Keep marketing preferences and campaign delivery state private to the
-- server. The public unsubscribe route uses the server-side Supabase secret;
-- browsers never receive direct table access.

create table public.marketing_contacts (
  email text primary key,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_contacts_normalized_email
    check (email = lower(btrim(email)) and email like '%@%')
);

create index marketing_contacts_unsubscribed_at_idx
  on public.marketing_contacts (unsubscribed_at)
  where unsubscribed_at is not null;

create table public.marketing_campaign_deliveries (
  campaign_id text not null,
  email text not null references public.marketing_contacts(email) on update cascade on delete cascade,
  status text not null default 'pending',
  attempts integer not null default 0,
  message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (campaign_id, email),
  constraint marketing_campaign_deliveries_status
    check (status in ('pending', 'sent', 'failed')),
  constraint marketing_campaign_deliveries_attempts
    check (attempts >= 0)
);

create index marketing_campaign_deliveries_status_idx
  on public.marketing_campaign_deliveries (campaign_id, status);

create index marketing_campaign_deliveries_email_idx
  on public.marketing_campaign_deliveries (email);

alter table public.marketing_contacts enable row level security;
alter table public.marketing_campaign_deliveries enable row level security;

revoke all on public.marketing_contacts from anon, authenticated;
revoke all on public.marketing_campaign_deliveries from anon, authenticated;
grant select, insert, update on public.marketing_contacts to service_role;
grant select, insert, update on public.marketing_campaign_deliveries to service_role;
