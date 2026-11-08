---
name: plan
description: ALWAYS use this skill when the owner asks for the migration plan, the discovery report, "what will it cost", "should we move", "what moves and what gets dropped", "how long will it take", or when setup reaches the report step. It writes kb/plan.md, the owner-facing kb/report.md and its HTML version docs/report.html (verdict, inventory, usage, processes, cost now vs after, effort, risks, cutover date, owner to-do), then asks the owner to approve. Nothing is built before approval.
---
# Plan and discovery report

Read kb/RULES.md, kb/context.md, kb/airtable/inventory.md, kb/airtable/usage.md, kb/processes.md and
kb/decisions.md first. References: [report outline](references/report-outline.md), [prices](references/prices.md),
[effort rules](references/effort.md).

## 1. Decide scope (draft)
- Moves: tables not proposed for drop; views (shared ones); interfaces → dashboard pages; forms → app forms.
- Dropped: the usage drop list, stale tables, personal views, broken formulas nobody uses. Each with its reason.
- Rebuilt by hand: formulas with no SQL twin, guessed rollups, script steps, buttons, synced tables.
  Get the list by running `npm run schema:from-airtable -- kb/airtable/inventory.json --out .migrate/app.schema.draft.json --notes .migrate/schema-notes.md`
  (a dry run; schema-designer writes the real files later). Count notes by level: check, rebuild, dropped.
- Automations: each → target (trigger, cron, webhook route, edge function), from kb/airtable/automations.md.
- Users and roles: seats by level → roles (owner/create → admin, edit → editor, comment/read → viewer,
  interfaceOnly → portal). Outside users from kb/context.md.

## 2. Cost now vs after
Use only [prices.md](references/prices.md) and counts from the inventory:
- Now: editor seats (owner + create + edit levels; count each person once) × the plan price the owner stated.
  If the plan is unknown, show Team and Business side by side, labelled `assumed`. Add Zapier/Make only if the
  owner stated their cost.
- After: Supabase Pro $25 + Vercel Pro $20 per developer seat (viewers free) + usage. Email sending if an
  automation needs it (owner picks the provider; cost `needs input`).
- Show seats with no recorded activity separately: they are savings even if they stay.
Never invent a price or a count. Every number gets its label and source.

## 3. Effort and dates
Use the rule table in [effort.md](references/effort.md): count tables, formulas to rebuild, automations by kind,
interface pages, roles. Sum to days. Show the table, not just the total. Parallel run: 3–5 days (sourced).
Cutover date: the owner's target from kb/context.md, or "needs input".

## 4. Risks
Data quality counts (duplicates, mixed types), plan limits near the cap (records, API calls, automation runs),
attachments over 50 MB per file on Supabase Free, script code still missing, external tools that store Airtable
record ids (they break at cutover), rollup functions guessed, view filters not yet captured.

## 5. Write the files
1. `kb/plan.md`: scope, order (the 13 steps in effort.md order), effort table, cutover window, open questions.
   Status: draft.
2. `kb/report.md`: follow [report-outline.md](references/report-outline.md) exactly. Short sentences. Tables over
   prose. A Mermaid links diagram is fine (it renders as code in the HTML; keep it short).
3. `npm run report:html` → `docs/report.html`. Open it or screenshot it at 1280 and 390 px and check it reads well.

## 6. Approval gate
Show the owner the verdict, cost table, scope and date. Ask: "Do you approve this plan?"
- Yes → `kb/decisions.md`: `<date> — Plan approved (scope, date) — owner — kb/plan.md`. Set plan.md and report.md
  `Status: approved`. Then mark dropped tables/fields with `"migrate": false` in kb/airtable/inventory.json.
- Changes → edit, re-render, ask again. No → write why in decisions.md and stop.

Write kb/runs/<YYYY-MM-DD>-plan.md; update kb/README.md status (plan, report) and tick step 7 in
kb/setup-state.md after approval.
