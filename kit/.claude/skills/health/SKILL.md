---
name: health
description: ALWAYS use this skill for the weekly scheduled check-up and whenever the owner asks "is everything ok", "any errors", "did the sync run", "are automations working", "health check", or "how is the app doing". It checks the live app, the deploy, automation runs and errors, the Airtable sync, row counts and people, open knowledge-base questions, and writes a short run log with what needs attention.
---
# Weekly health check

Read kb/RULES.md, kb/context.md (live URL), kb/automations.md and the last two files in kb/runs/ named
`*-health.md` first.

Works in a scheduled cloud session: needs only `curl` and, for the detail, `APP_URL` and `CRON_SECRET` in the
environment. Never print the secret.

## 1. Live app
- `curl -s "$APP_URL/api/health"` → `ok: true`, `mode: "supabase"`. Anything else is the top finding.
- Detail: `curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/health"` → `detail`:
  `automationRuns7d` (per job and status), `automationErrors7d`, `lastSyncs`, `rows` per table, `people` per role,
  `flags` (syncEnabled, automationsEnabled).
- A value starting "Could not load" is a failure, not a zero.

## 2. Judge
| Check | Healthy | Needs attention |
|---|---|---|
| Deploy | health answers | timeout or 5xx |
| Automations | every expected job ran; no `error` | any error; a job missing for its schedule; `skipped` after cutover |
| Sync (parallel run only) | last delta < 30 h old, status ok | older, error, or still enabled after cutover |
| Rows | stable or growing vs last week | a table dropped by more than 5% (possible deletes) |
| People | roles as in kb/access.md | new admins nobody decided; pending users waiting |
| Flags | before cutover: automations off; after: on, sync off | anything else |
Compare with last week's run log for trends.

## 3. Knowledge base
- Count open `needs input` items in kb/ (`grep -rn "needs input" kb/ | wc -l`) and list the top 3 for the owner.
- If kb/README.md is out of date or runs are older than 60 days, suggest `/kb-tidy`.

## 4. Write and tell
kb/runs/<YYYY-MM-DD>-health.md (10 lines max): status (green/amber/red), the numbers above, what changed since last
week, what needs attention and who should act. New problems also go to kb/findings.md (`F-<n>`).
Tell the owner only if something is amber or red, in two lines.

Update kb/README.md if any status changed.
