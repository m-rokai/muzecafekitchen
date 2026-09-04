alter table public.orders
  add column preorder_deadline timestamptz,
  add column preorder_delivery_date date,
  add constraint orders_preorder_schedule_shape check (
    (
      channel = 'cafe'
      and preorder_deadline is null
      and preorder_delivery_date is null
    )
    or (
      channel = 'partner_meal'
      and preorder_deadline is not null
      and preorder_delivery_date is not null
      and extract(isodow from preorder_delivery_date) = 1
      and (preorder_deadline at time zone 'America/Los_Angeles')::date
        = preorder_delivery_date - 5
      and (preorder_deadline at time zone 'America/Los_Angeles')::time = time '12:00:00'
    )
  );

comment on column public.orders.preorder_deadline is
  'Server-enforced Wednesday noon America/Los_Angeles cutoff captured when a partner meal order is created.';

comment on column public.orders.preorder_delivery_date is
  'Monday date when a weekly partner meal preorder is delivered to Muze for pickup.';
