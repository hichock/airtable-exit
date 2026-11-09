---
name: roles-and-access
description: ALWAYS use this skill when the owner talks about people and permissions: "invite the team", "who can see what", "give Anna edit access", "clients should only see their own projects", "remove a user", "roles", "permissions", and always before the data copy, so people map correctly. It turns Airtable collaborators into Supabase Auth invites with roles, maps interface-only users to a portal role, and writes and tests the RLS policies.
---
# Roles and access

Read kb/RULES.md, kb/context.md (outside users), kb/airtable/inventory.md (people counts), kb/airtable/usage.md
(seats) and kb/decisions.md first. People with emails are in `.migrate/people.json` (gitignored). Never copy
emails into kb/.

## 1. Map levels to roles
Default (sourced: Airtable permission levels; mapping assumed, agreed in the plan):
| Airtable level | Role here |
|---|---|
| owner, create | admin |
| edit | editor |
| comment, read | viewer |
| interfaceOnly (and outside users the owner named) | portal |
Roles and their table access live in `app.schema.json` → `roles` (read/write lists, `"*"` = all tables).
The database mirrors them in `app_roles` (written by the generated migration) and enforces them with
`app_can(table, action)` in every policy.

## 2. Propose, then one confirmation
Start from the approved plan (roles, outside users). Show one proposal: counts per role, who is invited (default:
people with recorded activity), who is not (default: seats with no recorded activity, listed as a count), and any
row-level limits the plan named. Ask once: "Invite these people now?" Inviting sends each person a sign-in email.
If the owner prefers to wait, invite the admins only; re-running the copy after later invites fixes person fields.
Write changes to kb/context.md (`stated`) and the rules to kb/decisions.md.

## 3. Invite
For each person to invite (from `.migrate/people.json`):
`npm run invite -- <email> <role> --airtable <usrId>`
The `--airtable` id links their Airtable activity (createdBy, person fields) to their new profile for the copy.
Sign-in is by email link; only invited people can sign in (`shouldCreateUser: false`).
Check: System page → People shows each person with the right role.

## 4. Row-level rules (only if step 2 asked for them)
Table-level access is automatic. For "clients see only their own records", write a new migration:
```sql
-- profiles.company_id says which company an outside user belongs to
alter table public.profiles add column company_id uuid references public.companies(id);
drop policy projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated using (
  public.app_can('projects', 'read') and (
    public.app_role() <> 'portal'
    or company_id = (select company_id from public.profiles where id = auth.uid())
  )
);
```
Only an admin can change `profiles` access columns (the `profiles_guard` trigger covers role, active, email;
extend it in the same migration for `company_id`).

## 5. Test as each role
Add cases to `supabase/tests/rls.sql` (it runs as viewer, portal, pending and admin with `set role authenticated`
and `request.jwt.claims`): what each role must see, must not see, must not change. Then `npm run test:migrations`.
Policies that read fine still leak; only these tests count. Then apply it the way schema-designer step A8 says.

## 6. Write down
kb/access.md: roles, what each can do, row-level rules, counts per role (no names), date of last review.

Write kb/runs/<YYYY-MM-DD>-roles-and-access.md; update kb/README.md status (access).
