alter table public.menu_items
  add column source_provider text,
  add constraint menu_items_source_shape check (
    source_provider is null or external_source_id is not null
  );

create unique index menu_items_cafe_source_idx
  on public.menu_items(source_provider, external_source_id)
  where channel = 'cafe' and source_provider is not null;

alter table public.modifier_groups
  add column source_provider text,
  add column external_source_id text,
  add constraint modifier_groups_source_shape check (
    (source_provider is null and external_source_id is null)
    or (source_provider is not null and external_source_id is not null)
  );

create unique index modifier_groups_source_idx
  on public.modifier_groups(source_provider, external_source_id)
  where source_provider is not null;

alter table public.modifier_options
  add column source_provider text,
  add column external_source_id text,
  add constraint modifier_options_source_shape check (
    (source_provider is null and external_source_id is null)
    or (source_provider is not null and external_source_id is not null)
  );

create unique index modifier_options_source_idx
  on public.modifier_options(source_provider, external_source_id)
  where source_provider is not null;

comment on column public.menu_items.external_source_id is
  'Stable provider object ID. For Square café items this is the exported catalog token.';
