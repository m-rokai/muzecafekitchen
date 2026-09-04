-- Partner meals are $19.00 before tax. The storefront displays and charges the
-- combined $20.59 amount while breaking out the included $1.59 on receipts.
update public.menu_items
set price_cents = 2059,
    updated_at = now()
where channel = 'partner_meal'
  and price_cents <> 2059;

-- Keep any already-staged import safe to publish after this pricing change.
update public.partner_menu_import_candidates
set price_cents = 2059
where price_cents <> 2059;
