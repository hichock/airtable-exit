# Your CRM (built with airtable-exit)

A Next.js app on Supabase that replaces an Airtable base. The whole app is described by `app.schema.json`:
tables, fields, views (grid, kanban, calendar), forms, dashboards and roles. Change the file, and the app follows.

## Run it

```bash
npm install
npm run demo          # http://localhost:3000 with sample data, no Supabase needed
```

With Supabase: copy `.env.example` to `.env.local`, fill in the keys, remove `DEMO=1`, then `npm run dev`.
Before inviting anyone: `npm run auth:check` (Supabase's built-in email only reaches members of your Supabase
organization; others need custom SMTP, for example Resend).
Without Supabase settings the app shows demo data and says so in a banner. It never crashes for missing env.

## Commands

| Command | What it does |
|---|---|
| `npm run demo` | Dev server with in-memory sample data |
| `npm test` | Unit tests (`node:test`): formulas, schema, views, sync, migration mapping |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run schema:check` | Validates `app.schema.json` |
| `npm run schema:sql -- <name>` | Writes the next `supabase/migrations/<n>_<name>.sql` from `app.schema.json` |
| `npm run schema:from-airtable -- kb/airtable/inventory.json` | Draft `app.schema.json` + `kb/schema.md` from the Airtable inventory |
| `npm run migrate:copy` | Copies Airtable → Supabase (snapshot, typed upsert, attachments, links). Files over `MAX_FILE_MB` (50) are listed, not copied. Safe to re-run |
| `npm run migrate:parity` | Row counts, missing and deleted (extra) ids per table, random record diffs. Exit 1 on any mismatch |
| `npm run report:html` | Renders `kb/report.md` → `docs/report.html` |
| `npm run auth:check -- [--fix]` | Checks what sign-in and invite emails need: live `NEXT_PUBLIC_SITE_URL`, Supabase Site URL and redirect URL, custom SMTP. `--fix` sets the two URLs (needs a Supabase access token) |
| `npm run invite -- <email> <role>` | Sends a Supabase invite with a role. Refuses a localhost `NEXT_PUBLIC_SITE_URL` |
| `bash scripts/check-staged.sh` | Refuses a commit with a staged `.env*` file or `.migrate/` (also the pre-commit hook scaffold installs) |
| `bash scripts/test-migrations-local.sh` | Applies all migrations to a throwaway local Postgres and runs RLS checks as each role |

## Where things are

```
app.schema.json            the app: tables, views, forms, dashboards, roles
schema/app.schema.v1.json  JSON Schema for editors (structure); lib/schema/validate.ts checks references
lib/schema/                types, validator, naming, schema → SQL
lib/formula/               Airtable formula parser → SQL (generated columns) and → TypeScript
lib/data/                  store interface, Supabase store, in-memory query, computed fields
lib/views/                 pure view models (grid, kanban, calendar, record, dashboard, forms) + tests
lib/airtable/              REST client (5 req/s, 429 back-off), record transform, copy/delta sync
lib/automations/           withRun() logging + rebuilt automations (example: stale-deals)
app/                       pages: /, /t/<table>/v/<view>, /t/<table>/r/<id>, /f/<form>, /forms/<public form>, /system
supabase/migrations/       0001_core.sql (people, roles, comments, activity, files, runs; RLS) + generated tables
scripts/                   migrate, schema-from-airtable, report, local migration test
```

## Rules this code follows

Pages are loader + pure view model + thin JSX. Server actions parse, load, decide, write.
Every table has RLS. A failed read shows "Could not load…", never an empty list.
Reads that can pass 1,000 rows page through them. Imports are keyed by `airtable_id`, so re-runs are safe.
Migrations are append-only. See `kb/dev-rules.md` in your project.
