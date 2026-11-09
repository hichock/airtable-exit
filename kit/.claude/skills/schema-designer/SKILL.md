---
name: schema-designer
description: ALWAYS use this skill when the database needs designing or changing: "design the tables", "turn our Airtable into Postgres", "add a field", "rename a column", "change a select option", "add a table", or when setup reaches the Supabase step. It maps the approved Airtable inventory to app.schema.json and append-only Supabase migrations (links → foreign keys or junction tables, lookups and rollups → SQL views, formulas → generated columns or TypeScript), with RLS on every table and a mapping in kb/schema.md. Do not hand-write tables outside this skill.
---
# Schema designer

Read kb/RULES.md, kb/context.md, kb/plan.md (must be approved), kb/airtable/inventory.json, kb/airtable/usage.md
and kb/decisions.md first. Mapping facts: [references/type-mapping.md](references/type-mapping.md).

## A. First design (from Airtable)
1. Check the plan is approved (`Status: approved` in kb/plan.md, a line in decisions.md). If not, stop and say so.
2. Draft:
   `npm run schema:from-airtable -- kb/airtable/inventory.json --base <appId> --name "<App name>" --out app.schema.json --notes kb/schema.md`
   It skips tables/fields marked `"migrate": false`, keeps one side of each link pair, maps types, turns rollups and
   lookups into SQL views, and tries every formula as a generated column (else `mode: "app"` with the reason).
3. Work through `kb/schema.md` top to bottom. For every `check` / `rebuild` row decide and write the result:
   - Single-link check: confirm no record links to more than one by sampling records (read-only). If some do, set
     `"multiple": true`. Don't ask the owner what the data can answer.
   - Guessed rollups: compare 5 records' Airtable values with what the function would give; fix `fn`.
   - App formulas: the app evaluates TODAY(), NOW(), DATETIME_DIFF and the basics. Others (REGEX_*, WORKDAY,
     DATETIME_FORMAT, ARRAYJOIN…) need TypeScript: add a function in `lib/formula/` with a test, or drop the field
     with the owner's OK.
   - Views: add `filters`, `sorts`, `by` and `cardFields` from the screenshots described in kb/airtable/interfaces.md
     if the owner sent any, else from the approved plan's best guesses (view names, grouping fields). Leave a
     `check` note on each guess; the owner sees them in the preview.
   - Primary field: must be a plain text field. Currency: check the code (`USD`, `EUR`…). Select colours come over.
4. Replace the example: delete `supabase/migrations/0002_example_crm.sql` **only if it was never applied** to this
   project's database (check `supabase migration list`). The demo seed in `lib/demo/seed.ts` is for the example CRM;
   with the new schema DEMO mode shows empty tables, which is expected.
5. Validate: `npm run schema:check` (no errors; read warnings).
6. Generate SQL: `npm run schema:sql -- <base_name>` → `supabase/migrations/<n>_<base_name>.sql`. Read it.
7. Test: `npm run test:migrations` (applies every migration to a throwaway Postgres and runs the RLS checks).
   Add a check to `supabase/tests/rls.sql` for each table that must be hidden from a role.
8. Apply with the path setup chose (kb/decisions.md): `supabase db push` (CLI), or the Supabase connector's
   `apply_migration` tool with each new file's SQL, in file order, named like the file. Keep to one path per project:
   the two record applied migrations differently. Then `npm run typecheck && npm test && npm run build`.

## B. Later changes (after the first push)
- Never edit an applied migration. Edit `app.schema.json`, then write a **new** migration by hand for the delta
  (`alter table … add column …`, new check constraint, new policy). Name it `<n>_<what>.sql`.
- Add a column: nullable first; backfill; then constraints in a later migration.
- Rename: add the new column, copy, switch the app, drop the old one in a later migration.
- Select option added: drop and re-create the `<table>_<field>_check` constraint in the new migration.
- Order: migration first, then code. Run step A7 and A8 again.

## C. Write down
- `kb/schema.md`: keep the generated table and add a "Decisions" list (what you changed and why).
- `kb/decisions.md`: one line per real choice (e.g. "<date> — Deals.Contacts stays many-to-many — some deals have 2+ contacts — app.schema.json").

## Rules
- `airtable_id text unique` stays on every table until 30 days after cutover (imports and redirects use it).
- RLS on every table, including junction tables (the generator does it; keep it for hand-written ones).
- Unknown Airtable types land as `jsonb` with a note. Never drop data silently.

Write kb/runs/<YYYY-MM-DD>-schema-designer.md; update kb/README.md status (schema: draft → done when pushed).
