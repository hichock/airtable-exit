---
name: sync-and-cutover
description: Runs the parallel run and the switch from Airtable to the new app when the owner starts it with /sync-and-cutover ("start the parallel run", "go live", "switch over", "freeze Airtable", "final sync", "turn off Airtable", "roll back"). Nightly delta sync while both run, then freeze, final sync, parity checks, flipping forms, webhooks and integrations, turning automations on here and off there, and a written rollback plan.
disable-model-invocation: true
---
# Sync and cutover

Read kb/RULES.md, kb/context.md (cutover date, freeze window, tools), kb/plan.md, kb/automations.md and
kb/access.md first. Checks: [references/cutover-checklist.md](references/cutover-checklist.md).

The owner started this skill. Each phase below needs a "go" from the owner before it starts.

## Phase 1: parallel run (3–5 days)
1. Pre-check: data copied and parity clean (latest `kb/runs/*-data-migrator.md`), people invited, pages approved.
2. Budget: nightly delta = about 1 call per table plus records changed ÷ 100. On Team plans check the 100,000
   monthly calls (kb/airtable/usage.md).
3. Turn on the nightly sync in Vercel (production):
   `vercel env add AIRTABLE_PAT production`, `vercel env add AIRTABLE_BASE_ID production`,
   `vercel env add SYNC_ENABLED production` (value `1`), check `CRON_SECRET` exists, then `vercel deploy --prod`.
   The cron in `vercel.json` calls `/api/cron/sync` nightly; it copies records modified since the last run
   (`IS_AFTER(LAST_MODIFIED_TIME(), …)`, the filter is assumed to work; check the first run's counts).
4. Tell the team in plain words: "Airtable stays the master this week. Try the new app; edits you make there
   can be overwritten by the nightly copy." Write this rule to kb/decisions.md.
5. Each morning: System page → Sync with Airtable is green; note counts in kb/cutover.md. Collect feedback.
Alternative for a no-code peek: the Supabase Airtable FDW (read-only) can mirror tables inside Postgres.

## Phase 2: freeze and final sync (in the freeze window)
1. Owner, in Airtable: make editors read-only (or announce "stop editing"). You cannot do this for them.
2. Final copy: `npm run migrate:copy -- --final --since <last sync time from sync_state>` (delta, idempotent),
   then `npm run migrate:parity -- --sample 50`. Every table must match. Fix and repeat if not.
3. Run the full checklist in references/cutover-checklist.md. Record each result in kb/cutover.md.

## Phase 3: flip
In this order, with the owner:
1. Owner turns off Airtable automations (keep them, just off).
2. Vercel: `AUTOMATIONS_ENABLED=1`, `SYNC_ENABLED=0`, remove `AIRTABLE_PAT` from Vercel; redeploy.
3. Forms: website embeds and links point to `/forms/<key>`. Webhooks and integrations (Zapier, Make, accounting)
   point to the new routes or the Supabase API. Anything that stored Airtable record ids: map via `airtable_id`.
4. Announce to the team: the new URL, how to sign in, where to ask.
5. Airtable base stays read-only for 30 days. Then the owner downgrades or cancels seats (the savings line).

## Rollback plan (write it in kb/cutover.md before Phase 3)
Airtable is untouched and read-only, so rollback = owner re-opens editing in Airtable and turns its automations
back on; Vercel `AUTOMATIONS_ENABLED=0`. Records created in the new app after the flip: export them
(Supabase SQL `select … where created_at > '<flip time>'`) and give the owner a CSV to paste into Airtable.
Decide the rollback deadline with the owner (e.g. 7 days) and write it down.

Write kb/runs/<YYYY-MM-DD>-sync-and-cutover.md per phase; update kb/README.md status (cutover: live) and
kb/context.md (target stack, cutover date `stated`).
