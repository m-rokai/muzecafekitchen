-- Extend automatic administrator access to the two approved partner accounts.
-- The exact email address is trusted only after Supabase confirms it; editable
-- user_metadata remains outside authorization decisions.
create or replace function private.sync_muzeoffice_admin_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  previous_role jsonb;
  access_source text := case
    when coalesce(lower(new.email) ~ '^[^@[:space:]]+@muzeoffice[.]com$', false)
      then 'muzeoffice.com'
    when lower(new.email) in ('info@cussworthy.cafe', 'cussworthycafe@gmail.com')
      then lower(new.email)
    else null
  end;
  identity_verified boolean :=
    new.email_confirmed_at is not null
    and not coalesce(new.is_anonymous, false)
    and access_source is not null;
begin
  if identity_verified then
    if not (metadata ? 'muze_domain_admin') then
      -- Remember independently assigned access so losing eligibility removes
      -- only this automatic grant, without erasing an operator-assigned role.
      metadata := metadata || jsonb_build_object(
        'muze_domain_admin', jsonb_build_object(
          'domain', access_source,
          'previous_role', metadata -> 'role'
        )
      );
    else
      -- Preserve the original base role if an account moves between approved
      -- identities, while recording the rule that currently grants access.
      metadata := metadata || jsonb_build_object(
        'muze_domain_admin',
        coalesce(metadata -> 'muze_domain_admin', '{}'::jsonb)
          || jsonb_build_object('domain', access_source)
      );
    end if;
    metadata := metadata || jsonb_build_object('role', 'admin');
  elsif metadata ? 'muze_domain_admin' then
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

revoke all on function private.sync_muzeoffice_admin_role() from public, anon, authenticated;

-- Reconcile the approved partner accounts if either already exists. The
-- existing trigger enforces confirmation and non-anonymous identity.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
where lower(email) in ('info@cussworthy.cafe', 'cussworthycafe@gmail.com');
