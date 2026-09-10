-- Run with psql -v ON_ERROR_STOP=1 -f supabase/tests/domain-admin.sql.
-- All synthetic auth records and metadata changes are rolled back. No email,
-- password, session, identity, or permanent test account is created.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

-- Exercise the installed trigger on actual auth.users rows. Hosted SQL access
-- cannot impersonate Supabase's internal Auth role; this is a database behavior
-- check, not an end-to-end Auth service sign-in test.
create temporary table domain_admin_checks (name text, passed boolean) on commit drop;

create function pg_temp.check_domain_role(label text, condition boolean)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Domain admin regression: %', label;
  end if;
  insert into pg_temp.domain_admin_checks values (label, true);
end;
$$;

create function pg_temp.domain_user(
  address text, confirmed boolean default true,
  anonymous boolean default false, metadata jsonb default '{}'::jsonb,
  editable_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql as $$
declare
  user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, aud, role, email, email_confirmed_at, is_anonymous,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    user_id, 'authenticated', 'authenticated', address,
    case when confirmed then now() else null end, anonymous,
    metadata, editable_metadata, now(), now()
  );
  return user_id;
end;
$$;

-- Trigger execution does not require exposing its function as an RPC. Prove
-- invocation with a client role that has no EXECUTE grant on the function.
create temporary table domain_admin_trigger_probe (
  email text, email_confirmed_at timestamptz, is_anonymous boolean,
  raw_app_meta_data jsonb
) on commit drop;
create trigger probe_domain_admin before insert on domain_admin_trigger_probe
for each row execute function private.sync_muzeoffice_admin_role();
grant select, insert on domain_admin_trigger_probe to authenticated;
set local role authenticated;
insert into pg_temp.domain_admin_trigger_probe
values ('trigger-probe@muzeoffice.com', now(), false, '{}'::jsonb);
do $$
begin
  if not (select raw_app_meta_data ->> 'role' = 'admin' from pg_temp.domain_admin_trigger_probe) then
    raise exception 'Invoking role could not execute the protected row trigger';
  end if;
end;
$$;
reset role;
insert into pg_temp.domain_admin_checks values ('row trigger works without a client EXECUTE grant', true);

do $$
declare
  subject uuid;
  record_metadata jsonb;
  invalid_email text;
  prefix text := 'domain-test-' || gen_random_uuid()::text;
begin
  subject := pg_temp.domain_user(prefix || '@muzeoffice.com', false);
  perform pg_temp.check_domain_role('unconfirmed email has no admin role',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));

  update auth.users set email_confirmed_at = now() where id = subject;
  perform pg_temp.check_domain_role('confirmation assigns admin to an existing account',
    (select raw_app_meta_data ->> 'role' = 'admin' from auth.users where id = subject));

  update auth.users set raw_app_meta_data = raw_app_meta_data || '{"provider":"email"}'::jsonb
    where id = subject;
  perform pg_temp.check_domain_role('provider metadata update preserves role and prior role',
    (select raw_app_meta_data ->> 'role' = 'admin'
      and raw_app_meta_data ->> 'provider' = 'email'
      and raw_app_meta_data #> '{muze_domain_admin,previous_role}' = 'null'::jsonb
      from auth.users where id = subject));

  update auth.users set email = prefix || '@example.com' where id = subject;
  perform pg_temp.check_domain_role('leaving domain removes the automatic grant',
    (select not (raw_app_meta_data ? 'role') and not (raw_app_meta_data ? 'muze_domain_admin')
      and raw_app_meta_data ->> 'provider' = 'email' from auth.users where id = subject));

  subject := pg_temp.domain_user(prefix || '+owner@MUZEOFFICE.COM');
  perform pg_temp.check_domain_role('case-insensitive exact domain and plus address qualify',
    (select raw_app_meta_data ->> 'role' = 'admin' from auth.users where id = subject));
  update auth.users set email_confirmed_at = null where id = subject;
  perform pg_temp.check_domain_role('revoking confirmation removes the automatic grant',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));

  subject := pg_temp.domain_user('info@cussworthy.cafe', false);
  perform pg_temp.check_domain_role('unconfirmed approved partner has no admin role',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));
  update auth.users set email_confirmed_at = now() where id = subject;
  perform pg_temp.check_domain_role('confirmed Cussworthy domain partner receives admin',
    (select raw_app_meta_data ->> 'role' = 'admin'
      and raw_app_meta_data #>> '{muze_domain_admin,domain}' = 'info@cussworthy.cafe'
      from auth.users where id = subject));
  update auth.users set email = prefix || '@cussworthy.cafe' where id = subject;
  perform pg_temp.check_domain_role('other Cussworthy addresses are not approved',
    (select raw_app_meta_data ->> 'role' is null
      and not (raw_app_meta_data ? 'muze_domain_admin') from auth.users where id = subject));

  subject := pg_temp.domain_user('CussworthyCafe@GMAIL.COM');
  perform pg_temp.check_domain_role('approved Gmail partner match is case-insensitive',
    (select raw_app_meta_data ->> 'role' = 'admin'
      and raw_app_meta_data #>> '{muze_domain_admin,domain}' = 'cussworthycafe@gmail.com'
      from auth.users where id = subject));
  update auth.users set email = 'cussworthycafe+test@gmail.com' where id = subject;
  perform pg_temp.check_domain_role('Gmail plus aliases are not approved',
    (select raw_app_meta_data ->> 'role' is null
      and not (raw_app_meta_data ? 'muze_domain_admin') from auth.users where id = subject));

  subject := pg_temp.domain_user(prefix || '+anonymous@muzeoffice.com', true, true);
  perform pg_temp.check_domain_role('anonymous identity never receives domain admin',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));
  update auth.users set is_anonymous = false where id = subject;
  perform pg_temp.check_domain_role('verified identity conversion assigns admin',
    (select raw_app_meta_data ->> 'role' = 'admin' from auth.users where id = subject));
  update auth.users set is_anonymous = true where id = subject;
  perform pg_temp.check_domain_role('anonymous conversion removes the automatic grant',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));

  foreach invalid_email in array array[
    prefix || '@muzeoffice.com.evil.example', prefix || '@sub.muzeoffice.com',
    prefix || '@notmuzeoffice.com', prefix || '@muzeoffice.co',
    prefix || '@muzeoffice.com ', prefix || '@muzeoffice.com' || chr(10),
    prefix || '@muzeoffice.com@example.com', '@muzeoffice.com', null
  ] loop
    subject := pg_temp.domain_user(invalid_email);
    perform pg_temp.check_domain_role('reject non-exact email ' || coalesce(invalid_email, '(null)'),
      (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));
  end loop;

  subject := pg_temp.domain_user(prefix || '+spoof@example.com', true, false, '{}',
    '{"role":"admin","email":"owner@muzeoffice.com","email_verified":true}');
  perform pg_temp.check_domain_role('editable metadata cannot confer administrator access',
    (select raw_app_meta_data ->> 'role' is null from auth.users where id = subject));

  subject := pg_temp.domain_user(prefix || '+staff@muzeoffice.com', true, false,
    '{"role":"staff","provider":"email","custom_flag":true}');
  perform pg_temp.check_domain_role('domain staff account is promoted to admin',
    (select raw_app_meta_data ->> 'role' = 'admin' from auth.users where id = subject));
  update auth.users set email = prefix || '+staff@example.com' where id = subject;
  select raw_app_meta_data into record_metadata from auth.users where id = subject;
  perform pg_temp.check_domain_role('independent staff role and unrelated metadata are restored',
    record_metadata = '{"role":"staff","provider":"email","custom_flag":true}'::jsonb);

  subject := pg_temp.domain_user(prefix || '+manual@example.com', true, false, '{"role":"admin"}');
  perform pg_temp.check_domain_role('independent non-domain admin grant remains intact',
    (select raw_app_meta_data = '{"role":"admin"}'::jsonb from auth.users where id = subject));
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'private.sync_muzeoffice_admin_role()', 'execute')
    or has_function_privilege('authenticated', 'private.sync_muzeoffice_admin_role()', 'execute') then
    raise exception 'Domain admin trigger must not be client-callable';
  end if;
end;
$$;
select jsonb_build_object('checks_passed', count(*), 'client_execution_revoked', true,
  'checks', jsonb_agg(name)) as domain_admin_test_result from pg_temp.domain_admin_checks;
rollback;
