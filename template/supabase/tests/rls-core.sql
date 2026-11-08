-- Core RLS checks that hold for every schema. Runs after all migrations (scripts/test-migrations-local.sh).
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'viewer@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'portal@example.com'),
  ('00000000-0000-0000-0000-000000000004', 'new@example.com');
update public.profiles set role = 'admin' where email = 'admin@example.com';
insert into public.comments (table_key, record_id, author_id, body)
  values ('any_table', '10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'seed');

set role authenticated;

-- a new sign-up has role "pending": sees only its own profile, no comments, can't make itself admin
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
do $$ declare n int; begin
  select count(*) into n from public.profiles; if n <> 1 then raise exception 'pending user sees only own profile'; end if;
  select count(*) into n from public.comments; if n <> 0 then raise exception 'pending user must read no comments'; end if;
  select count(*) into n from public.automation_runs; if n <> 0 then raise exception 'pending user must read no runs'; end if;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'pending user must not change own role';
  exception when raise_exception then
    if sqlerrm not like 'Only an admin%' then raise; end if;
  end;
end $$;

-- admin reads comments; a comment must be written as yourself
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
do $$ declare n int; begin
  select count(*) into n from public.comments; if n <> 1 then raise exception 'admin should read comments'; end if;
  begin
    insert into public.comments (table_key, record_id, author_id, body) values ('any_table', gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'spoof');
    raise exception 'comment as someone else must fail';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
select 'rls core: all checks passed' as result;
