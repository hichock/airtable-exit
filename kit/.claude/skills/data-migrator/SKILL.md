---
name: data-migrator
description: Copies the Airtable data into Supabase when the owner starts it with /data-migrator ("copy the data", "import the records", "run the migration", "check the numbers match"). Snapshot to JSON, typed upsert keyed by airtable_id, attachments downloaded at once into Supabase Storage, links in a second pass, comments optional, then a parity report (row counts and 20 random record diffs per table). Safe to re-run.
disable-model-invocation: true
---
# Data migrator

Read kb/RULES.md, kb/context.md, kb/plan.md, kb/schema.md and kb/airtable/usage.md first.
Limits: [references/limits.md](references/limits.md).

The owner started this skill. Still confirm once before the first write: "I will copy <n> records and <GB> of files
from <base> into <Supabase project>. Airtable is only read. OK?"

## 1. Pre-flight (all must pass)
- `.env.local` has `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Migrations applied: `supabase migration list` shows every local file as applied remotely.
- `app.schema.json` tables and fields carry `airtable.id` (written by schema-designer). `npm run schema:check` passes.
- People first: invite the team (`/roles-and-access`) so `createdBy` and person fields map to profiles. Unmapped
  people are reported, never invented; you can re-run after inviting them.
- Budget: records ÷ 100 calls per table (+ comments: 1 call per record that has comments). On Team plans compare
  with the 100,000 monthly calls (kb/airtable/usage.md → API budget).
- Storage: total attachment GB vs the Supabase plan; any file over 50 MB needs Pro.

## 2. Copy
```bash
set -a; . ./.env.local; set +a
npm run migrate:copy -- --comments      # leave out --comments if there are none or the budget is tight
```
What it does (lib/airtable/sync.ts): per table, pages records at 100 per call (5 calls/s, waits 30 s on 429),
appends raw JSON to `.migrate/snapshot/*.jsonl` (the backup), upserts typed rows on `airtable_id`, downloads each
attachment right away (URLs expire in 2 hours) to Storage at `<table>/<recordId>/<attId>-<name>`, and records one
`sync_runs` row per table. After all tables it writes links: FK columns for single links, junction rows for
many-to-many. Output: a table of read/written/files/comments/warnings and `.migrate/copy-report.json`.

If it stops halfway: fix the cause, run the same command again. Upserts make it safe.

## 3. Parity
```bash
npm run migrate:parity -- --sample 20
```
Per table: Airtable count vs Supabase count, and a field-by-field diff of 20 random records after normalising
(dates to UTC, empty → null, arrays sorted). Exit code 1 if anything differs; details in `.migrate/parity-report.json`.

Then check by hand (SQL in the Supabase SQL editor; paste results as counts only):
- Link parity: for each link field, count of links per side matches Airtable (e.g. deals with a company).
- Computed parity: rebuilt formulas and rollups vs the values Airtable showed (from the snapshot). List
  mismatches; don't hide them.
- Attachments: files and bytes match `kb/airtable/usage.md`; open three files from the app.

## 4. Fix and repeat
Mismatches usually come from: a single link that held two records (set `multiple: true`, new migration), a select
value missing from the options (new migration), time zones on dateTime, people not invited. Fix, re-run copy, re-run
parity. Each finding goes to kb/findings.md (`F-<n>`).

## 5. Report
Tell the owner: tables copied, records, files, comments, mismatches left (with reason), and how long it took.
The app now shows real data. Airtable is still the source of truth until cutover.

Write kb/runs/<YYYY-MM-DD>-data-migrator.md (counts per table, calls used, duration, warnings, parity result);
update kb/README.md status.
