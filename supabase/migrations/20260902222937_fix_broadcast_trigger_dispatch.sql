create or replace function private.broadcast_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'kitchen',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

create or replace function private.broadcast_setting_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.key, old.key) not in ('kitchen_open', 'kitchen_closed_message') then
    return null;
  end if;

  perform realtime.broadcast_changes(
    'kitchen',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function private.broadcast_order_change() from public;
revoke all on function private.broadcast_setting_change() from public;

drop trigger orders_broadcast_kitchen_change on public.orders;
create trigger orders_broadcast_kitchen_change
after insert or update or delete on public.orders
for each row execute function private.broadcast_order_change();

drop trigger settings_broadcast_kitchen_change on public.settings;
create trigger settings_broadcast_kitchen_change
after insert or update or delete on public.settings
for each row execute function private.broadcast_setting_change();

drop function private.broadcast_kitchen_change();
