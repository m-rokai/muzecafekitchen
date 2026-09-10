-- Refresh the customer-facing food menu from the partner's written menu and
-- the Square catalog export dated 2026-09-10. Square remains authoritative
-- for prices, availability, and external identifiers.

insert into public.modifier_groups (
  name, display_name, min_selections, max_selections, required, sort_order,
  source_provider, external_source_id
)
values (
  'FOOD', 'Food add-ons', 0, 1, false, 3,
  'square', 'PYENBWT5NRMN63GXQ7IJPKX2'
)
on conflict (source_provider, external_source_id) where source_provider is not null
do update set
  name = excluded.name,
  display_name = excluded.display_name,
  min_selections = excluded.min_selections,
  max_selections = excluded.max_selections,
  required = excluded.required,
  sort_order = excluded.sort_order;

insert into public.modifier_options (
  group_id, name, display_name, price_adjustment_cents, available, sort_order,
  source_provider, external_source_id
)
select
  mg.id, source.name, source.name, source.price_cents, true, source.sort_order,
  'square', source.external_source_id
from (values
  ('Turkey Bacon', 111, 0, 'PYENBWT5NRMN63GXQ7IJPKX2:turkey bacon'),
  ('Turkey Sausage', 111, 1, 'PYENBWT5NRMN63GXQ7IJPKX2:turkey sausage'),
  ('Double Meat', 333, 2, 'PYENBWT5NRMN63GXQ7IJPKX2:double meat')
) as source(name, price_cents, sort_order, external_source_id)
join public.modifier_groups mg
  on mg.source_provider = 'square'
 and mg.external_source_id = 'PYENBWT5NRMN63GXQ7IJPKX2'
on conflict (source_provider, external_source_id) where source_provider is not null
do update set
  group_id = excluded.group_id,
  name = excluded.name,
  display_name = excluded.display_name,
  price_adjustment_cents = excluded.price_adjustment_cents,
  available = true,
  sort_order = excluded.sort_order;

update public.menu_items as item
set
  name = source.name,
  description = source.description,
  sort_order = source.sort_order,
  updated_at = now()
from (values
  ('ECYTEP6QYR2FYD7CERBQXC2F', 'Breakfast Burrito', 'Egg, potatoes, your choice of bacon or sausage, salsa, and black beans.', 2),
  ('ZJNM3GW4R5F2CZQNXYET7K74', 'Breakfast Sandwich', 'Egg and cheese on wheat or sourdough, with bacon or sausage.', 0),
  ('Q7G5FZA437QTKFLJRU5BLIL6', 'Breakfast Bowl', 'Grits, potatoes, black beans, salsa, bacon, and sausage.', 1),
  ('W4F6GBYGY36LGEAHTQYJTJDS', 'Bulgogi', 'Ground beef, green onion, red onion, sesame seeds, garlic aioli, and a pairing salad.', 21),
  ('BEMULVPJR6IEC34FP4OYXMHU', 'Caesar Salad', 'Chicken, romaine, Caesar dressing, and Parmesan.', 18),
  ('4XFCZDIHPNH2CHLHDCM64UST', 'Club Sub', 'Turkey, bacon, lettuce, tomato, and mayo.', 20),
  ('3MRUOQMLAP5IMNRKUGQHGO3Q', 'Harvest', 'Turkey, stuffing, and cranberry.', 19),
  ('DX7OO2K4ITZKIWN2M3JKDGAJ', 'Italian Chop', 'Salami, turkey, ham, banana peppers, lettuce, mayo, mustard, and red wine vinegar.', 17),
  ('UTK5XEUFC3C7KJ5L4643I2UT', 'Taco Salad', 'Black beans, chicken tinga, lettuce, cheese, salsa, and chipotle ranch.', 22)
) as source(external_source_id, name, description, sort_order)
where item.channel = 'cafe'
  and item.source_provider = 'square'
  and item.external_source_id = source.external_source_id;

-- Match Square's current item assignments exactly: the optional FOOD set is
-- attached to the breakfast sandwich and burrito only.
delete from public.item_modifier_groups as link
using public.modifier_groups as modifier_group, public.menu_items as item
where link.group_id = modifier_group.id
  and link.item_id = item.id
  and modifier_group.source_provider = 'square'
  and modifier_group.external_source_id = 'PYENBWT5NRMN63GXQ7IJPKX2'
  and item.channel = 'cafe';

insert into public.item_modifier_groups (item_id, group_id)
select item.id, modifier_group.id
from public.menu_items as item
join public.modifier_groups as modifier_group
  on modifier_group.source_provider = 'square'
 and modifier_group.external_source_id = 'PYENBWT5NRMN63GXQ7IJPKX2'
where item.channel = 'cafe'
  and item.source_provider = 'square'
  and item.external_source_id in (
    'ECYTEP6QYR2FYD7CERBQXC2F',
    'ZJNM3GW4R5F2CZQNXYET7K74'
  )
on conflict do nothing;
