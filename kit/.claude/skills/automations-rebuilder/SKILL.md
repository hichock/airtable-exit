---
name: automations-rebuilder
description: ALWAYS use this skill when the owner talks about automations, reminders, notifications or integrations to rebuild: "rebuild our automations", "send an email when…", "when a deal is won…", "every Monday…", "replace Zapier", "post to Slack", "webhook". It turns each Airtable automation in kb/airtable/automations.md into a database trigger, a Vercel cron route or a webhook route with a runs log, kept off until cutover so nothing fires twice.
---
# Automations rebuilder

Read kb/RULES.md, kb/context.md, kb/airtable/automations.md, kb/processes.md and kb/dev-rules.md first.
Patterns with code: [references/patterns.md](references/patterns.md).

## 1. List and decide
For each row in kb/airtable/automations.md (only those that are on, unless the owner says otherwise):
- Trigger → target (see patterns): record created/updated/matches → app hook or Postgres trigger;
  scheduled → Vercel cron route; form submitted → server action; webhook received → webhook route.
- Each step → code: create/update/find records → `store` calls; send email → provider API (key needed);
  Slack → incoming webhook URL (secret); run script → TypeScript port with a test (code from the owner).
- Write the target in the `Rebuild:` column with status `todo`. Ask the owner for any missing key or script once.

## 2. Build one at a time
Use the stale-deals example as the shape: `lib/automations/<name>.ts` with a pure `decide…()` and a `run…()`
that loads, decides and writes; a test file with literal cases; registration in `app/api/cron/[job]/route.ts`
(`JOBS`) and a schedule in `vercel.json` if it runs on time.
- Every run goes through `withRun()`, so it lands in `automation_runs` and on the System page.
- Idempotent: a re-run must not send twice or create duplicates (check for an existing row first, or key on a
  unique column).
- Secrets: `.env.local` + Vercel env. Add the name to `.env.example`.
- Database triggers: in a new migration. Skip rows written by imports (`created_by is null and airtable_id is not
  null`), or they fire on every copied record.

## 3. Keep it off until cutover
Cron jobs skip while `AUTOMATIONS_ENABLED` is not `1` (the route checks it). App hooks and triggers must check the
same flag (or a `settings` row). Airtable's automations keep running until the owner turns them off at cutover.

## 4. Test
- Unit tests for `decide…()`. Then a dry run: call the route locally with the flag on against demo or staging data:
  `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/<name>`.
- Compare the output with Airtable's run history screenshots for the same day (kept 6 months on Team, 1 year on
  Business). Record matches and differences in kb/airtable/automations.md.

## 5. Write down
kb/automations.md: one row per automation: Airtable name → new name, trigger, schedule, flag, test status, owner
sign-off. Mark the row `done` in kb/airtable/automations.md. Decisions (e.g. "no auto-emails to clients") go to
kb/decisions.md.

Write kb/runs/<YYYY-MM-DD>-automations-rebuilder.md; update kb/README.md status (automations).
