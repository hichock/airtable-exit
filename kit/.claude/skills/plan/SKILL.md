---
name: plan
description: ALWAYS use this skill when the owner asks for the migration plan, the discovery report, "what will it cost", "should we move", "what moves and what gets dropped", "how long will it take", or when setup reaches the plan step. It writes ONE plan for the owner (kb/plan.md, kb/report.md, docs/report.html): what we found, what moves as is, what is missing or unclear with the agent's best guess and how it will be handled, what the new app can do better, cost now vs after (free tiers by default), effort and risks. The owner approves it or comments on any line. Nothing is built before approval.
---
# Plan and report (one approval)

Read kb/RULES.md, kb/context.md, kb/airtable/inventory.md, kb/airtable/usage.md, kb/processes.md (with its Gaps)
and kb/decisions.md first. References: [report outline](references/report-outline.md), [prices](references/prices.md),
[effort rules](references/effort.md).

This is the owner's only big decision. Make it easy: plain words, short lines, a default for everything open.
Do not ask questions before writing it. Every open point goes into the plan with a best guess.

## 1. Decide scope (draft)
- Moves as is: tables not proposed for drop; shared views; interfaces → dashboard pages; forms → app forms.
- Dropped: the usage drop list, stale tables, personal views, broken formulas nobody uses. Each with its reason.
- Rebuilt by hand: formulas with no SQL twin, guessed rollups, script steps, buttons, synced tables.
  Get the list by running `npm run schema:from-airtable -- kb/airtable/inventory.json --out .migrate/app.schema.draft.json --notes .migrate/schema-notes.md`
  (a dry run; schema-designer writes the real files later). Count notes by level: check, rebuild, dropped.
- Automations: each → target (trigger, cron, webhook route, edge function), from kb/airtable/automations.md.
- Users and roles: seats by level → roles (owner/create → admin, edit → editor, comment/read → viewer,
  interfaceOnly → portal).
- Missing or unclear: every gap from kb/processes.md and every "check" note, each with the best guess, the default
  handling, and what would make it better (a screenshot, script code, a yes/no). These are suggestions, not
  conditions: the build goes ahead with the defaults.
- Improvements: what the new app can do that the base can't today, only where the data shows a reason. Examples:
  duplicates found → a duplicate check on create; text fields holding emails or phones → typed fields; a kanban
  used daily → the same board on phones; seats with no activity → no per-seat cost; a slow interface → a dashboard
  page. Each with the evidence (count, label) and the effort row it needs. Mark them optional.

## 2. Cost now vs after
Use only [prices.md](references/prices.md) and counts from the inventory:
- Now: editor seats (owner + create + edit levels; count each person once) × the plan price the owner stated.
  If the plan is unknown, show Team and Business side by side, labelled `assumed`. Add Zapier/Make only if the
  owner stated their cost.
- After, default: Supabase Free + Vercel Hobby = $0 per month. Email sending only if an automation needs it
  (provider and cost `needs input`).
- Check the free limits against the measured numbers: files over 50 MB, total files over 1 GB, database size
  estimate over 500 MB, more than 2 active Supabase projects on the account. For each limit that is hit, write the
  choice: keep big files where they are and link them, or upgrade that one service (Supabase Pro from $25/month,
  Vercel Pro $20 per developer seat). Paid plans are an option, never the default.
- Show seats with no recorded activity separately: they are savings even if they stay.
Never invent a price or a count. Every number gets its label and source.

## 3. Effort and dates
Use the rule table in [effort.md](references/effort.md): count tables, formulas to rebuild, automations by kind,
interface pages, roles. Sum to days. Show the table, not just the total. Parallel run: 3–5 days (sourced).
Cutover date: the owner's target from kb/context.md, or a proposal labelled `assumed`.

## 4. Risks
Data quality counts (duplicates, mixed types), plan limits near the cap (records, API calls, automation runs),
files over the storage limits, script code still missing, external tools that store Airtable record ids (they break
at cutover), rollup functions guessed, view filters not yet captured, records deleted in Airtable during the
parallel run (the nightly sync does not delete; parity shows them).

## 5. Write the files
1. `kb/plan.md`: scope, order (the steps in effort.md order), effort table, cutover window, gaps with defaults.
   Status: draft.
2. `kb/report.md`: follow [report-outline.md](references/report-outline.md) exactly. Short sentences. Tables over
   prose. A Mermaid links diagram is fine (it renders as code in the HTML; keep it short).
3. `npm run report:html` → `docs/report.html`. Open it or screenshot it at 1280 and 390 px and check it reads well.

## 6. Approval (the one question)
Show the owner, in the chat: the verdict, the cost table, what moves, what is missing with your guesses, the
optional improvements and the optional "send me X to make it better" items. Then ask once:
"Approve this plan, or tell me what to change?"
- Yes → `kb/decisions.md`: `<date> — Plan approved (scope, defaults for gaps, plans: free tiers) — owner — kb/plan.md`.
  Set plan.md and report.md `Status: approved`. Mark dropped tables/fields with `"migrate": false` in
  kb/airtable/inventory.json.
- Comments → apply them (answers to gaps become `stated` in kb/context.md or kb/processes.md), re-render, show only
  what changed, ask again.
- No → write why in decisions.md and stop.
Files the owner sends later (screenshots, script code) improve the build at any time; they never reopen approval.

Write kb/runs/<YYYY-MM-DD>-plan.md; update kb/README.md status (plan, report) and tick step 5 (Plan approved) in
kb/setup-state.md after approval.
