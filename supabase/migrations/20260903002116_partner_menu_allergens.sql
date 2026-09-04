alter table public.menu_items
  add column if not exists possible_allergens text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'menu_items_possible_allergens_known_check'
      and conrelid = 'public.menu_items'::regclass
  ) then
    alter table public.menu_items
      add constraint menu_items_possible_allergens_known_check
      check (
        possible_allergens <@ array[
          'Milk', 'Egg', 'Fish', 'Crustacean shellfish', 'Tree nuts',
          'Peanuts', 'Wheat', 'Soy', 'Sesame'
        ]::text[]
        and cardinality(possible_allergens) <= 9
      );
  end if;
end
$$;

comment on column public.menu_items.possible_allergens is
  'Possible FDA major allergens inferred from the partner-published dish name and description; not an allergen-free guarantee.';

update public.menu_items
set possible_allergens = array_remove(array[
  case when concat_ws(' ', name, description) ~* '\m(milk|cream|cheese|yogurt|yoghurt|butter|ghee|whey|casein)\M' then 'Milk' end,
  case when concat_ws(' ', name, description) ~* '\m(egg|eggs|mayonnaise|mayo|aioli)\M' then 'Egg' end,
  case when concat_ws(' ', name, description) ~* '\m(fish|salmon|tuna|cod|halibut|tilapia|trout|bass|flounder)\M' then 'Fish' end,
  case when concat_ws(' ', name, description) ~* '\m(shellfish|shrimp|prawn|crab|lobster|crayfish)\M' then 'Crustacean shellfish' end,
  case when concat_ws(' ', name, description) ~* '\m(almond|walnut|cashew|pecan|pistachio|hazelnut|macadamia|brazil nut|pine nut)\M' then 'Tree nuts' end,
  case when concat_ws(' ', name, description) ~* '\m(peanut|groundnut)\M' then 'Peanuts' end,
  case when concat_ws(' ', name, description) ~* '\m(wheat|couscous|pasta|orzo|bread|breadcrumbs|bulgur|farro|semolina)\M' then 'Wheat' end,
  case when concat_ws(' ', name, description) ~* '\m(soy|soya|tofu|tempeh|edamame|miso|tamari)\M' then 'Soy' end,
  case when concat_ws(' ', name, description) ~* '\m(sesame|tahini)\M' then 'Sesame' end
], null)
where channel = 'partner_meal';
