-- Snapshot published from the MUZE Offices Square catalog export dated 2026-09-10.

-- Existing café items are retired, not deleted, to preserve historical order references.

update public.menu_items set available = false, updated_at = now() where channel = 'cafe';

insert into public.categories (name, description, sort_order, channel) values
  ('Breakfast', '', 0, 'cafe'),
  ('Espresso', '', 1, 'cafe'),
  ('Matcha', '', 2, 'cafe'),
  ('Tea & Lemonade', '', 3, 'cafe'),
  ('Smoothies', '', 4, 'cafe'),
  ('Lunch', '', 5, 'cafe')
on conflict (name) do update set sort_order = excluded.sort_order, channel = 'cafe';

update public.modifier_groups mg
set source_provider = 'square', external_source_id = source.external_source_id
from (values
  ('MILK', 'AUI5S5JTUMICINBLARPRS7FP'),
  ('ADD INS', 'QB3MYTIGULMYELMQZFMP77XX'),
  ('SUBSTITUTES', 'N4VIOXHOOLRJAWJIUB6UEDS4')
) as source(name, external_source_id)
where mg.name = source.name and mg.source_provider is null;

insert into public.modifier_groups (name, display_name, min_selections, max_selections, required, sort_order, source_provider, external_source_id)
select source.name, source.display_name, source.min_selections, source.max_selections, source.required, source.sort_order, 'square', source.external_source_id
from (values
  ('MILK', 'Milk', 0, 1, false, 0, 'AUI5S5JTUMICINBLARPRS7FP'),
  ('ADD INS', 'Add ins', 0, 3, false, 1, 'QB3MYTIGULMYELMQZFMP77XX'),
  ('SUBSTITUTES', 'Substitutes', 0, 1, false, 2, 'N4VIOXHOOLRJAWJIUB6UEDS4')
) as source(name, display_name, min_selections, max_selections, required, sort_order, external_source_id)
on conflict (source_provider, external_source_id) where source_provider is not null
do update set name = excluded.name, display_name = excluded.display_name, min_selections = excluded.min_selections, max_selections = excluded.max_selections, required = excluded.required, sort_order = excluded.sort_order;

update public.modifier_options mo
set source_provider = 'square', external_source_id = source.external_source_id
from (values
  ('AUI5S5JTUMICINBLARPRS7FP', 'AUI5S5JTUMICINBLARPRS7FP:oat milk', 'Oat Milk', 100, 0),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:collagen peptides', 'Collagen Peptides', 200, 0),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:olive oil shot', 'Olive Oil Shot', 200, 1),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:vanilla protein', 'Vanilla Protein', 200, 2),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom coffee', 'Mushroom Coffee', 200, 0),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom matcha', 'Mushroom Matcha', 200, 1),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom chai', 'Mushroom Chai', 200, 2)
) as source(group_external_source_id, external_source_id, name, price_cents, sort_order)
join public.modifier_groups mg on mg.source_provider = 'square' and mg.external_source_id = source.group_external_source_id
where mo.group_id = mg.id and mo.name = source.name and mo.source_provider is null;

insert into public.modifier_options (group_id, name, display_name, price_adjustment_cents, available, sort_order, source_provider, external_source_id)
select mg.id, source.name, source.name, source.price_cents, true, source.sort_order, 'square', source.external_source_id
from (values
  ('AUI5S5JTUMICINBLARPRS7FP', 'AUI5S5JTUMICINBLARPRS7FP:oat milk', 'Oat Milk', 100, 0),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:collagen peptides', 'Collagen Peptides', 200, 0),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:olive oil shot', 'Olive Oil Shot', 200, 1),
  ('QB3MYTIGULMYELMQZFMP77XX', 'QB3MYTIGULMYELMQZFMP77XX:vanilla protein', 'Vanilla Protein', 200, 2),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom coffee', 'Mushroom Coffee', 200, 0),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom matcha', 'Mushroom Matcha', 200, 1),
  ('N4VIOXHOOLRJAWJIUB6UEDS4', 'N4VIOXHOOLRJAWJIUB6UEDS4:mushroom chai', 'Mushroom Chai', 200, 2)
) as source(group_external_source_id, external_source_id, name, price_cents, sort_order)
join public.modifier_groups mg on mg.source_provider = 'square' and mg.external_source_id = source.group_external_source_id
on conflict (source_provider, external_source_id) where source_provider is not null
do update set group_id = excluded.group_id, name = excluded.name, display_name = excluded.display_name, price_adjustment_cents = excluded.price_adjustment_cents, available = true, sort_order = excluded.sort_order;

update public.modifier_options set available = false where source_provider is distinct from 'square';

insert into public.menu_items (external_source_id, name, description, price_cents, category_id, available, sort_order, channel, source_provider)
select source.external_source_id, source.name, source.description, source.price_cents, c.id, source.available, source.sort_order, 'cafe', 'square'
from (values
  ('ECYTEP6QYR2FYD7CERBQXC2F', 'Breakfast Burrito', 'A loaded breakfast burrito with egg, potatoes, bacon or sausage, salsa, and black beans.', 999, 'Breakfast', true, 0),
  ('ZJNM3GW4R5F2CZQNXYET7K74', 'Breakfast Sandwich', 'Egg, cheese, and your choice of bacon or sausage, wheat or sourdough bread.', 999, 'Breakfast', true, 1),
  ('Q7G5FZA437QTKFLJRU5BLIL6', 'Power Bowl', 'An energising breakfast bowl with egg whites, spinach, chicken andouille sausage and fresh red salsa.', 999, 'Breakfast', true, 2),
  ('OZYIS75SZMROWCJZS33C42PW', 'Banana Bread Latte', 'Rich espresso, sweet ripe bananas and a hint of aromatic cardamom, creating a cozy and unique latte experience.', 888, 'Espresso', true, 3),
  ('73YWMAEHJDEVUVMSUL5BS6OJ', 'Black Cherry Truffle Latte', 'A rich espresso base infused with the sweet and tart notes of black cherry, complemented by the earthy depth of truffle essence, creating a luxurious and aromatic latte.', 888, 'Espresso', true, 4),
  ('22LQ2TKS7KCTYT3PWZZTNAKQ', 'Earl Grey Lavender Latte', 'A harmonious blend of robust Earl Grey tea, fragrant lavender, and milk topped with a delicate foam.', 888, 'Espresso', true, 5),
  ('CJ37WSTADP374WXWYM4VOMM3', 'Miso Brown Sugar Latte', 'A harmonious blend of savory miso and rich brown sugar creates a velvety, creamy texture.', 888, 'Espresso', true, 6),
  ('6EAVZSSHVVPRIUDKWSZWGXPT', 'Pistachio Cheesecake Latte', 'A creamy latte with rich pistachio flavor, topped cheesecake foam.', 888, 'Espresso', true, 7),
  ('UPDFO5BMWYNXOQQSCCZYOX5E', 'Banana Bread Matcha', 'Silky Matcha, sweet ripe bananas and a hint of aromatic cardamom, creating a cozy and unique latte experience.', 888, 'Matcha', true, 8),
  ('Q7GLFDUUERIZQQB4UFC2HTH6', 'Black Cherry Truffle Matcha', 'Silky matcha base infused with the sweet and tart notes of black cherry, complemented by the earthy depth of truffle essence, creating a luxurious and aromatic latte.', 888, 'Matcha', true, 9),
  ('62F26DS5R3GDHNIIIZ2TDMR4', 'Earl Grey Lavender Matcha', 'A harmonious blend of robust Earl Grey tea, fragrant lavender, and milk topped with a delicate foam.', 888, 'Matcha', true, 10),
  ('O5R3BIZ7ZLQAGHUIJIFTXA7D', 'Miso Brown Sugar Matcha', 'A harmonious blend of savory miso and rich brown sugar creates a velvety, creamy texture.', 888, 'Matcha', true, 11),
  ('YSRZFC77TTXNZ4L67RHF62D6', 'Pistachio Cheesecake Matcha', 'A creamy latte with rich pistachio flavor, topped cheesecake foam.', 888, 'Matcha', true, 12),
  ('HG36AO35BEOUZ3U5LNJLUQDM', 'Rosemary Mint Green Tea Lemonade', 'A refreshing blend of rosemary, invigorating mint, and zesty lemonade combined with green tea for a unique, aromatic drink.', 777, 'Tea & Lemonade', true, 13),
  ('I6M2TRE65EJBK2XZS72JDIR4', 'Strawberry Thai Basil Green Tea Lemonade', 'Refreshing jasmine green tea lemonade infused with sweet strawberry and aromatic Thai basil.', 777, 'Tea & Lemonade', true, 14),
  ('YJQNCQKHQTX6O4WZLZ6RKT4O', 'Sunrise Glow Smoothie', 'A vibrant smoothie blending the earthy sweetness of carrot, the tropical flavors of mango and pineapple, and the zesty kick of turmeric and ginger, balanced perfectly with beet and freshly squeezed orange juice.', 1212, 'Smoothies', true, 15),
  ('QTLI26ZEY632QV536O6KISH7', 'Surf''s Up Smoothies', 'A refreshing blend of creamy avocado, ripe banana, and juicy pineapple, combined with smooth coconut yogurt, vibrant blue spirulina, and a touch of vanilla collagen protein powder for an extra boost.', 1212, 'Smoothies', true, 16),
  ('W4F6GBYGY36LGEAHTQYJTJDS', 'Bulgogi Bowl', 'Savory Korean-inspired bowl with marinated ground beef, green onion, pickles daikon salad, sesame seeds and garlic aioli.', 1212, 'Lunch', true, 17),
  ('BEMULVPJR6IEC34FP4OYXMHU', 'Chicken Caesar Sub', 'Classic Caesar salad with chicken, romaine, Caesar dressing, and Parmesan.', 1111, 'Lunch', true, 18),
  ('4XFCZDIHPNH2CHLHDCM64UST', 'Club Sub', 'A classic club sub with turkey, bacon, lettuce, tomato, and mayo.', 1111, 'Lunch', true, 19),
  ('3MRUOQMLAP5IMNRKUGQHGO3Q', 'Harvest Sub', 'A seasonal turkey sandwich with stuffing and cranberry sauce.', 1111, 'Lunch', true, 20),
  ('DX7OO2K4ITZKIWN2M3JKDGAJ', 'Italian Chop', 'A chopped Italian-style sandwich with salami, turkey, ham, banana peppers, lettuce, mayo, mustard, and red wine vinegar.', 1111, 'Lunch', true, 21),
  ('UTK5XEUFC3C7KJ5L4643I2UT', 'Taco Salad Bowl', 'Loaded taco salad with black beans, chicken tinga, lettuce, cheese, salsa, Spanish rice and chipotle ranch.', 1212, 'Lunch', true, 22)
) as source(external_source_id, name, description, price_cents, category_name, available, sort_order)
join public.categories c on c.name = source.category_name and c.channel = 'cafe'
on conflict (source_provider, external_source_id) where channel = 'cafe' and source_provider is not null
do update set name = excluded.name, description = excluded.description, price_cents = excluded.price_cents, category_id = excluded.category_id, available = excluded.available, sort_order = excluded.sort_order, updated_at = now();

delete from public.item_modifier_groups img using public.menu_items mi where img.item_id = mi.id and mi.channel = 'cafe' and mi.source_provider = 'square';

insert into public.item_modifier_groups (item_id, group_id)
select mi.id, mg.id
from (values
  ('Q7GLFDUUERIZQQB4UFC2HTH6', 'AUI5S5JTUMICINBLARPRS7FP'),
  ('Q7GLFDUUERIZQQB4UFC2HTH6', 'QB3MYTIGULMYELMQZFMP77XX'),
  ('Q7GLFDUUERIZQQB4UFC2HTH6', 'N4VIOXHOOLRJAWJIUB6UEDS4'),
  ('O5R3BIZ7ZLQAGHUIJIFTXA7D', 'AUI5S5JTUMICINBLARPRS7FP'),
  ('O5R3BIZ7ZLQAGHUIJIFTXA7D', 'QB3MYTIGULMYELMQZFMP77XX'),
  ('O5R3BIZ7ZLQAGHUIJIFTXA7D', 'N4VIOXHOOLRJAWJIUB6UEDS4')
) as source(item_external_source_id, group_external_source_id)
join public.menu_items mi on mi.source_provider = 'square' and mi.external_source_id = source.item_external_source_id and mi.channel = 'cafe'
join public.modifier_groups mg on mg.source_provider = 'square' and mg.external_source_id = source.group_external_source_id
on conflict do nothing;
