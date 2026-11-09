# Effort rule table

Use these defaults to state effort. Never estimate outside this table; add a row and a decision instead.
Template-based rows are **assumed** (our defaults with this template; adjust after the first project and record
the change in decisions.md). Hand-built comparison and the parallel run are **sourced** (WitsCode, read 2026-11-08).

| Item | Days (with this template) | Note |
|---|---:|---|
| Setup: repo, Supabase, Vercel, auth | 0.5 | Mostly logins and waiting |
| Schema: per 5 tables | 0.5 | Review mapping notes, fix types, views from screenshots |
| Formula to rebuild in TypeScript (each) | 0.25 | Plus a test |
| Rollup with guessed function (each) | 0.1 | Compare with Airtable values |
| Interface page → dashboard/page (each) | 0.5 | From a screenshot |
| Custom page beyond config (each) | 1 | Loader + view model + tests |
| Automation, internal only (each) | 0.5 | Trigger or cron + runs log |
| Automation with an external API (each) | 1–2 | Needs the owner's keys |
| Script step / scripting extension (each) | 1 | Needs the code |
| Data copy + parity, per base | 1 | Re-runs included |
| Roles, invites, RLS | 0.5 | +1 per outside-user group with row-level rules |
| Parallel run (calendar days) | 3–5 | sourced: WitsCode |
| Cutover + checks | 0.5 | Freeze, final sync, flips |

Hand-built comparison (sourced, WitsCode): grid with inline edit 3–5 days, saved views ~2, Kanban ~1, database ~2;
Interfaces "a separate two-week engagement"; whole build 3 weeks + 3–5 days parallel run for an 8-user base.

Step order for plan.md (based on Airtable exit research §6, 2026-11-08; changed 2026-11-09: no interview round,
gaps go into the plan; people are invited before the data copy so person fields map):
1 connect · 2 inventory · 3 usage · 4 process map with gaps · 5 plan and approval · 6 target schema ·
7 app pages · 8 roles, invites, RLS · 9 data copy · 10 automations · 11 parallel run · 12 cutover.
