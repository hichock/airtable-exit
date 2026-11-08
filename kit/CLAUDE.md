# This project

Our own CRM, moved off Airtable. Next.js on Vercel, Supabase (Postgres, Auth, Storage), code on GitHub.
The app is driven by `app.schema.json`. The migration is run by the skills in `.claude/skills/`, which read and
write the knowledge base in `kb/`. Installed by airtable-exit (lowcoding.dev).

## Read the knowledge base first. Always.
1. Start of every session: read `kb/README.md` (the map) and follow `kb/RULES.md`.
2. Before any task: read `kb/context.md`. Never ask the owner something already written there.
3. Then read only the files your task needs. Each skill names its inputs.
4. If `kb/setup-state.md` has open `[ ]` steps, finish setup first: `/airtable-exit:setup` (plugin) or follow
   `kb/setup-state.md` by hand.

## When the owner says X, use skill Y
Use the skill. Do not do these tasks freehand.

| Owner says (or means) | Skill | Writes |
|---|---|---|
| "what's in our Airtable", "scan the base", "inventory", "what do we have" | `discover` | `kb/airtable/inventory.md`, `inventory.json` |
| "what do we actually use", "dead fields", "who uses what", "clean up before moving" | `usage-analysis` | `kb/airtable/usage.md` |
| "how do we work", "our processes", "what does each automation do" | `process-map` | `kb/processes.md`, `kb/context.md` |
| "plan it", "what will it cost", "report", "should we move" | `plan` | `kb/plan.md`, `kb/report.md`, `docs/report.html` |
| "design the database", "tables", "schema", "add a field", "change a field" | `schema-designer` | `app.schema.json`, `supabase/migrations/*`, `kb/schema.md` |
| "build the pages", "dashboard", "make it look like our interface", "add a view" | `app-builder` | `app.schema.json`, `app/`, `components/` |
| "copy the data", "import", "migrate records", "check the numbers match" | `data-migrator` (owner runs `/data-migrator`) | Supabase rows, `kb/runs/` |
| "rebuild automations", "emails when…", "when a record changes…", "Zapier replacement" | `automations-rebuilder` | `lib/automations/`, `kb/automations.md` |
| "invite", "who can see what", "permissions", "client access", "roles" | `roles-and-access` | Supabase Auth, RLS, `kb/access.md` |
| "switch over", "go live", "turn off Airtable", "freeze", "parallel run" | `sync-and-cutover` (owner runs `/sync-and-cutover`) | `kb/cutover.md` |
| "is everything ok", "errors", "health", weekly scheduled run | `health` | `kb/runs/` |
| "remember", "from now on", "don't do X", "we decided" | `kb-keeper` | `kb/decisions.md` etc. |
| "tidy the kb", "what do you need from me" | `kb-tidy` | `kb/README.md` |

Order of a migration: discover → usage-analysis → process-map → plan (owner approves) → schema-designer →
app-builder → data-migrator → automations-rebuilder → roles-and-access → sync-and-cutover → health (weekly).

## Code rules (full version: `kb/dev-rules.md`)
- **Preview first.** Work on a branch, push, check the Vercel preview, show the owner, then merge. Previews share
  the production database: no bulk writes from a preview.
- **Page = loader + pure view model + thin JSX.** `page.tsx` reads params, calls one loader in `lib/loaders.ts`
  (reads only, throws "Could not load …"), one view model in `lib/views/*` (pure, tested), then renders.
- **Server action = parse → load → decide → write → message.** `decide` is pure and has a test.
- **Small functions.** Aim for complexity ≤ 10 and under 60 lines (`.ts`) or 100 lines (`.tsx`).
- **RLS on every table**, with explicit policies. Access is enforced on the server and in Postgres, never only in UI.
- **No silent failures.** A failed read shows "Could not load …" or "—", never an empty list or 0. A capped list
  says it was cut off.
- **1,000-row cap.** Supabase returns at most 1,000 rows per request. Anything that can grow pages through it
  (`store.all()` does this).
- **Idempotent writes.** Imports and syncs are keyed by `airtable_id`. Jobs can re-run safely.
- **Migrations are append-only.** Never edit an applied file. New change = new file. Apply the migration before the
  code that needs it. Test with `npm run test:migrations` first.
- **A bug fix starts with a failing test.** Tests check behaviour with literal expected values.
- **UI**: reuse the tokens in `app/globals.css` and the components in `components/`. Every screen works at 390 px
  (cards, no sideways scroll, 40 px touch targets). Handle loading, empty, error and long-list states.
- Before saying done: `npm run typecheck && npm test && npm run build`.

## Never
- Never put a token, key or password in `kb/`, a commit, a log or the chat. Secrets live in `.env.local` and Vercel.
- Never write to Airtable. It stays the source of truth until cutover, and read-only for 30 days after.
- Never copy personal data (names, emails, phones, record contents) into `kb/`. Counts and aggregates only.
  People lists for invites stay in `.migrate/` (gitignored).
- Never invent a number. Label it `measured`, `sourced`, `stated`, `assumed` or `needs input`.
- Never run `data-migrator` or `sync-and-cutover` steps unless the owner started that skill.
- Never edit an applied migration, disable RLS, or use the service-role key in browser code.
- Never delete Airtable data or turn off Airtable automations yourself. Give the owner the checklist.

## Commands
`npm run demo` · `npm test` · `npm run typecheck` · `npm run build` · `npm run schema:check` ·
`npm run schema:sql -- <name>` · `npm run migrate:copy` · `npm run migrate:parity` · `npm run report:html` ·
`npm run invite -- <email> <role>` · `npm run test:migrations`
