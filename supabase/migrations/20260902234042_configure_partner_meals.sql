-- Prepared partner meals are sold for pickup at Muze's Clark County location.
-- Keep this separate from the café rate so each storefront is calculated and
-- audited independently.
insert into public.settings (key, value) values
  ('partner_tax_rate', '0.08375')
on conflict (key) do update set value = excluded.value;
