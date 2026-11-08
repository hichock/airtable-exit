# Knowledge base map

This is the project's memory. Rules: [RULES.md](RULES.md). Every skill reads this map first.
Status values: `empty` (not started), `draft`, `approved`, `done`, `live`.

## Project
| File | What | Status |
|---|---|---|
| [context.md](context.md) | Company, people (roles only), tools, owner answers | draft |
| [setup-state.md](setup-state.md) | Setup checklist (resumable) | in progress |
| [plan.md](plan.md) | What moves, what is dropped, order, cutover date | empty |
| [report.md](report.md) | Discovery report for the owner (HTML: `docs/report.html`) | empty |
| [processes.md](processes.md) | Business processes the base runs, who does what | empty |
| [decisions.md](decisions.md) | Decisions and standing rules, newest first | live |
| [findings.md](findings.md) | Things that broke or surprised us | live |
| [dev-rules.md](dev-rules.md) | How code is written and shipped here | live |

## Airtable (what we found)
| File | What | Status |
|---|---|---|
| [airtable/README.md](airtable/README.md) | What goes in this folder | live |
| airtable/inventory.md + inventory.json | Bases, tables, fields, views, automations, interfaces, counts | empty |
| airtable/usage.md | Fill rates, activity, dead fields, don't-migrate list | empty |

## Build (written as we go)
| File | What | Status |
|---|---|---|
| schema.md | Airtable field → Postgres column mapping (from `npm run schema:from-airtable`) | empty |
| automations.md | Each Airtable automation → its rebuild and status | empty |
| access.md | Roles, who has which, RLS notes | empty |
| cutover.md | Parallel run, freeze, final sync, checks, rollback | empty |

## Logs
- [runs/](runs/) one file per skill run: `<YYYY-MM-DD>-<skill>.md`
- [research/README.md](research/README.md) research index
