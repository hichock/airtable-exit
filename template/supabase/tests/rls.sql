-- RLS checks as real roles (not by reading policies). Run by scripts/test-migrations-local.sh.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
\set ON_ERROR_STOP 1
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'viewer@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'portal@example.com'),
  ('00000000-0000-0000-0000-000000000004', 'new@example.com');
update public.profiles set role = 'admin' where email = 'admin@example.com';
update public.profiles set role = 'viewer' where email = 'viewer@example.com';
update public.profiles set role = 'portal' where email = 'portal@example.com';
insert into public.companies (id, name, status) values ('10000000-0000-0000-0000-000000000001', 'Acme Test', 'Lead');
insert into public.deals (name, company_id, value, probability, stage) values ('Test deal', '10000000-0000-0000-0000-000000000001', 1000, 0.5, 'Proposal');
insert into public.tasks (title, status) values ('Test task', 'To do');

do $$
declare n int;
begin
  -- generated formula
  select weighted_value into n from public.deals where name = 'Test deal';
  if n <> 500 then raise exception 'weighted_value expected 500, got %', n; end if;
  -- rollup view
  select pipeline_value into n from public.companies_computed where name = 'Acme Test';
  if n <> 1000 then raise exception 'pipeline_value expected 1000, got %', n; end if;
end $$;

set role authenticated;

-- viewer: reads everything, writes nothing
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002"}';
do $$ declare n int; begin
  select count(*) into n from public.companies; if n <> 1 then raise exception 'viewer should read companies'; end if;
  update public.companies set name = 'x'; get diagnostics n = row_count;
  if n <> 0 then raise exception 'viewer must not update companies'; end if;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'viewer must not change own role';
  exception when raise_exception then
    if sqlerrm not like 'Only an admin%' then raise; end if;
  end;
end $$;

-- portal: tasks only
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003"}';
do $$ declare n int; begin
  select count(*) into n from public.companies; if n <> 0 then raise exception 'portal must not read companies'; end if;
  select count(*) into n from public.tasks; if n <> 1 then raise exception 'portal should read tasks'; end if;
  update public.tasks set status = 'Done'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'portal should update tasks'; end if;
end $$;

-- pending (new signup): nothing
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004"}';
do $$ declare n int; begin
  select count(*) into n from public.tasks; if n <> 0 then raise exception 'pending user must read nothing'; end if;
  select count(*) into n from public.profiles; if n <> 1 then raise exception 'pending user sees only own profile'; end if;
end $$;

-- admin: writes, and comments need author = self
set request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';
do $$ declare n int; begin
  update public.companies set name = 'Acme Renamed'; get diagnostics n = row_count;
  if n <> 1 then raise exception 'admin should update companies'; end if;
  insert into public.comments (table_key, record_id, author_id, body)
    values ('companies', '10000000-0000-0000-0000-000000000001', auth.uid(), 'Hello');
end $$;

reset role;
select 'rls: all checks passed' as result;
