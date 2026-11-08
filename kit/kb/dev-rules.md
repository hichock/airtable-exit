# Development rules

Status: live. How code is written and shipped in this project. `CLAUDE.md` has the short version.
Why these rules: each one prevents a failure that is common in small CRM projects (silent data loss, leaked access,
broken deploys). Change a rule only through `decisions.md`.

## 1. How a change ships (preview first)
1. New screen or layout change: describe or sketch it first (fake data is fine) and get the owner's OK.
2. Build on one branch per working session. Push as often as needed; Vercel builds a preview for each push.
3. Send the owner the preview link with what to check (pages, cases, roles).
4. Previews use the production database. On a preview: no bulk writes, no imports, test with a test user.
5. Ship when the owner accepts: merge `main` in (merge, never force-push), run the checks, one pull request,
   one merge. One production deploy.
6. Before saying done: the production deploy is READY and `/api/health` answers.
7. Batch finished work into one PR. Not one PR per small change.
8. Ask before changes to load or cost: a new cron, a sync that reads more, a new paid service. Give the options and
   their cost, then build.

Checks before every merge: `npm run typecheck && npm test && npm run build`, plus `npm run test:migrations` when
`supabase/` changed.

## 2. Code quality
| Rule | Why |
|---|---|
| A bug fix starts with a failing test that reproduces it | A guard that hides the error is not a fix |
| Test behaviour, not implementation; literal expected values | A test that recomputes the answer like the code does checks nothing |
| After two failed fixes on one idea, write the idea down and rethink | A third fix on a wrong premise wastes the day |
| Subtract before you add; one decision lives in one place | Lists that must agree drift apart |
| Refactor = pin with tests → change structure → prove; never in the same commit as a behaviour change | Mixed commits hide what broke |
| One concern per commit; the message says why | Reviewable history |

## 3. Small functions
- Aim: complexity ≤ 10. Ceiling: `.ts` 12 and 60 lines; `.tsx` 20 and 100 lines.
- **Page = loader + pure view model + thin JSX.** `page.tsx` guards, reads params, calls `loadX(...)` in
  `lib/loaders.ts` (reads only, throws "Could not load …"), then `toXView(raw, …)` in `lib/views/x-view.ts`
  (pure, no I/O, with a test), then renders one component per section.
- **Server action = parse → load → decide → write → message.** Each its own function; `decide` is pure and tested.
- **Normalise once where data enters.** Loaders and parsers return typed shapes with defaults; views don't repeat
  `?.`/`??` chains. No `as any`.
- **A new request is a new unit**: a new tab, mode or field group gets its own component or view-model function.
  Permissions are resolved once into the view model (`canWrite`).
- **No speculative code.** No options or abstractions nobody asked for. Remove what your change made unused.

## 4. Correctness
| Rule | Why |
|---|---|
| Access is enforced on the server and by RLS, never only in the UI. Every new table gets RLS and explicit policies. People never write columns that grant access (`profiles.role` is guarded by a trigger). | The database API is reachable directly with the anon key |
| No silent failures: a failed read shows "Could not load …" or "—", never an empty list or 0. Capped lists say so. | A 0 that means "failed" is read as a fact |
| Supabase returns at most 1,000 rows per request and cuts larger ranges silently. Reads that can pass 1,000 rows page through (`store.all()`), ordered by a unique key. | Dashboards quietly lose rows otherwise |
| Writes are idempotent. Imports key on `airtable_id`; junction rows on their primary key. Re-runs update, never duplicate. | Jobs re-run; networks fail halfway |
| Test access as each real role (`npm run test:migrations` runs RLS checks as viewer, portal, pending and admin). | Policies read fine and still leak |
| External APIs: check field names against one live read before relying on them. | APIs rename fields |
| Dates: store `date` for days and `timestamptz` for moments; format in the app's time zone (`app.schema.json` → `app.timeZone`). Never `toISOString().slice(0, 10)` for "today" in a non-UTC business. | Late-evening work lands on the wrong day |

## 5. Migrations and the database
- Every schema change is a migration in `supabase/migrations/`, numbered, append-only. Never edit an applied file.
- Generated migrations come from `npm run schema:sql -- <name>`; hand-written ones for changes after that.
- Test first: `npm run test:migrations` (local Postgres, no credentials), then `supabase db push`.
- Order: migration first, then the code that needs it. A cron that calls a new route: deploy the route first.
- Git is the source of truth: no dashboard-only edits. Auth settings, buckets and crons are in a migration or
  written down in `kb/`.

## 6. Secrets and personal data
- Secrets never enter the repo, `kb/` or the chat. Local: `.env.local` (gitignored); production: Vercel env.
  `.env.example` lists the names.
- The service-role key is server-only: scripts, cron routes, public form handler, invites.
- Changing a Vercel env var needs a redeploy.
- No personal data in the repo or `kb/`: no exports, no fixtures with real names (tests use example.com).
- Grep for keys before every commit: `git diff --cached | grep -iE "eyJ|sk_|pat[A-Za-z0-9]{10}|service_role"`.

## 7. UI checklist
Before building:
1. Start from how the team works in Airtable today (the view or interface they use). Keep that shape unless the
   owner agrees otherwise.
2. Name only what was asked for. List each element and why it is there.

While building:
3. One primary action per row; the row (or its primary cell) opens the record.
4. Edit in place where they edited in Airtable; save at once; destructive actions are confirmed or undoable.
5. Hide empty blocks; empty states are one quiet line.
6. Dense tables on desktop (13 px, one line per record), keyboard reachable, visible focus.
7. Mobile is required (390 px): one card per record with the main facts; no sideways page scroll; touch targets
   ≥ 40 px; native date inputs.
8. Every state: loading, empty, error, long lists (paging), long names (truncate, full text on hover).
9. Reuse `app/globals.css` tokens and `components/`. No new visual language per screen. Light and dark both work.

Before reporting done:
10. Look at it at 1280 px and 390 px (Playwright or a browser), with demo data and with real data when available.
11. Say what was not checked.
12. Record UI decisions in `decisions.md`.
