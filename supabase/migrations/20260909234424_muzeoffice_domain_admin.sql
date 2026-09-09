-- Keep one protected role for the existing API, admin UI, and Realtime policies.
-- Only Supabase's confirmed account email is trusted; user_metadata is ignored.
create or replace function private.sync_muzeoffice_admin_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  previous_role jsonb;
  domain_verified boolean :=
    new.email_confirmed_at is not null
    and not coalesce(new.is_anonymous, false)
    and coalesce(lower(new.email) ~ '^[^@[:space:]]+@muzeoffice[.]com$', false);
begin
  if domain_verified then
    if metadata #>> '{muze_domain_admin,domain}' is distinct from 'muzeoffice.com' then
      -- Remember independently assigned access so leaving the domain removes
      -- only this automatic grant, without erasing an operator-assigned role.
      metadata := metadata || jsonb_build_object(
        'muze_domain_admin', jsonb_build_object(
          'domain', 'muzeoffice.com',
          'previous_role', metadata -> 'role'
        )
      );
    end if;
    metadata := metadata || jsonb_build_object('role', 'admin');
  elsif metadata #>> '{muze_domain_admin,domain}' = 'muzeoffice.com' then
    previous_role := metadata #> '{muze_domain_admin,previous_role}';
    metadata := metadata - 'muze_domain_admin' - 'role';
    if previous_role is not null and previous_role <> 'null'::jsonb then
      metadata := metadata || jsonb_build_object('role', previous_role);
    end if;
  end if;

  new.raw_app_meta_data := metadata;
  return new;
end;
$$;

-- This is a row trigger, not a client-callable RPC. It needs no elevated role
-- or additional grants: it only changes the NEW row already being written.
revoke all on function private.sync_muzeoffice_admin_role() from public, anon, authenticated;

create trigger sync_muzeoffice_admin_role
before insert or update of email, email_confirmed_at, is_anonymous, raw_app_meta_data
on auth.users
for each row execute function private.sync_muzeoffice_admin_role();

-- Reconcile existing domain accounts as well as future signups/confirmations.
-- The trigger itself enforces confirmation and non-anonymous identity.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
where lower(email) ~ '^[^@[:space:]]+@muzeoffice[.]com$';
