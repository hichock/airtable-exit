-- Generated from app.schema.json by scripts/schema-sql.ts. Do not edit; add a new migration instead.

-- Tables
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  "name" text,
  "status" text,
  "industry" text,
  "size" text,
  "website" text,
  "city" text,
  "notes" text
);
alter table public.companies add constraint companies_status_check check ("status" is null or "status" in ('Lead', 'Active client', 'Past client', 'Churned'));
alter table public.companies add constraint companies_industry_check check ("industry" is null or "industry" in ('SaaS', 'E-commerce', 'Health', 'Education', 'Finance', 'Hospitality'));
alter table public.companies add constraint companies_size_check check ("size" is null or "size" in ('1-10', '11-50', '51-200', '200+'));

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  "name" text,
  "title" text,
  "email" text,
  "phone" text,
  "stage" text,
  "last_contacted" date,
  "linkedin" text
);
alter table public.contacts add constraint contacts_stage_check check ("stage" is null or "stage" in ('New', 'Contacted', 'Qualified', 'Not a fit'));

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  "name" text,
  "stage" text,
  "value" numeric(14, 0),
  "probability" numeric,
  "close_date" date,
  "source" text
);
alter table public.deals add constraint deals_stage_check check ("stage" is null or "stage" in ('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'));
alter table public.deals add constraint deals_source_check check ("source" is null or "source" in ('Referral', 'Website', 'Outbound', 'Event'));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  airtable_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  "title" text,
  "status" text,
  "priority" text,
  "due" date,
  "notes" text
);
alter table public.tasks add constraint tasks_status_check check ("status" is null or "status" in ('To do', 'In progress', 'Done'));
alter table public.tasks add constraint tasks_priority_check check ("priority" is null or "priority" in ('Low', 'Medium', 'High'));

-- Links to one record and people
alter table public.companies add column "owner_id" uuid references public.profiles(id) on delete set null;

alter table public.contacts add column "company_id" uuid references public.companies(id) on delete set null;

create index on public.contacts ("company_id");

alter table public.deals add column "company_id" uuid references public.companies(id) on delete set null;

create index on public.deals ("company_id");

alter table public.deals add column "owner_id" uuid references public.profiles(id) on delete set null;

alter table public.tasks add column "assignee_id" uuid references public.profiles(id) on delete set null;

alter table public.tasks add column "deal_id" uuid references public.deals(id) on delete set null;

create index on public.tasks ("deal_id");

alter table public.tasks add column "company_id" uuid references public.companies(id) on delete set null;

create index on public.tasks ("company_id");

-- Formulas stored as generated columns
alter table public.deals add column "weighted_value" numeric generated always as ((coalesce("value", 0) * coalesce("probability", 0))) stored;

-- Links to many records (junction tables)
create table public.deals_contacts_links (
  from_id uuid not null references public.deals(id) on delete cascade,
  to_id uuid not null references public.contacts(id) on delete cascade,
  position int not null default 0,
  primary key (from_id, to_id)
);
create index on public.deals_contacts_links (to_id);

-- Keep updated_at current
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();

create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

create trigger deals_touch before update on public.deals for each row execute function public.touch_updated_at();

create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();

-- Row level security
alter table public.companies enable row level security;
create policy companies_read on public.companies for select to authenticated using (public.app_can('companies', 'read'));
create policy companies_insert on public.companies for insert to authenticated with check (public.app_can('companies', 'write'));
create policy companies_update on public.companies for update to authenticated using (public.app_can('companies', 'write')) with check (public.app_can('companies', 'write'));
create policy companies_delete on public.companies for delete to authenticated using (public.app_can('companies', 'write') and public.app_role() = 'admin');

alter table public.contacts enable row level security;
create policy contacts_read on public.contacts for select to authenticated using (public.app_can('contacts', 'read'));
create policy contacts_insert on public.contacts for insert to authenticated with check (public.app_can('contacts', 'write'));
create policy contacts_update on public.contacts for update to authenticated using (public.app_can('contacts', 'write')) with check (public.app_can('contacts', 'write'));
create policy contacts_delete on public.contacts for delete to authenticated using (public.app_can('contacts', 'write') and public.app_role() = 'admin');

alter table public.deals enable row level security;
create policy deals_read on public.deals for select to authenticated using (public.app_can('deals', 'read'));
create policy deals_insert on public.deals for insert to authenticated with check (public.app_can('deals', 'write'));
create policy deals_update on public.deals for update to authenticated using (public.app_can('deals', 'write')) with check (public.app_can('deals', 'write'));
create policy deals_delete on public.deals for delete to authenticated using (public.app_can('deals', 'write') and public.app_role() = 'admin');

alter table public.tasks enable row level security;
create policy tasks_read on public.tasks for select to authenticated using (public.app_can('tasks', 'read'));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.app_can('tasks', 'write'));
create policy tasks_update on public.tasks for update to authenticated using (public.app_can('tasks', 'write')) with check (public.app_can('tasks', 'write'));
create policy tasks_delete on public.tasks for delete to authenticated using (public.app_can('tasks', 'write') and public.app_role() = 'admin');

alter table public.deals_contacts_links enable row level security;
create policy deals_contacts_links_read on public.deals_contacts_links for select to authenticated using (public.app_can('deals', 'read'));
create policy deals_contacts_links_insert on public.deals_contacts_links for insert to authenticated with check (public.app_can('deals', 'write'));
create policy deals_contacts_links_update on public.deals_contacts_links for update to authenticated using (public.app_can('deals', 'write')) with check (public.app_can('deals', 'write'));
create policy deals_contacts_links_delete on public.deals_contacts_links for delete to authenticated using (public.app_can('deals', 'write') and public.app_role() = 'admin');

-- Lookups and rollups (views; RLS of the base table applies)
create or replace view public.companies_computed with (security_invoker = true) as
select t.*,
  (select coalesce(sum(r."value"), 0) from public.deals r where r."company_id" = t.id) as "pipeline_value",
  (select count(*) from public.deals r where r."company_id" = t.id) as "deal_count"
from public.companies t;

create or replace view public.contacts_computed with (security_invoker = true) as
select t.*,
  (select x."industry" from public.companies x where x.id = t."company_id") as "company_industry"
from public.contacts t;

-- Roles
insert into public.app_roles (key, label, can_read, can_write) values
  ('admin', 'Admin', array['*'], array['*']),
  ('editor', 'Editor', array['*'], array['*']),
  ('viewer', 'Viewer', array['*'], array[]::text[]),
  ('portal', 'Outside user', array['tasks'], array['tasks'])
on conflict (key) do update set label = excluded.label, can_read = excluded.can_read, can_write = excluded.can_write;
