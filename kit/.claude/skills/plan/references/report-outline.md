# Discovery report outline (one page per base + a summary)

Based on what agencies inventory before an Airtable migration (WitsCode 1-week audit; Scroll "always start with an
audit"; Softr migration checklist; read 2026-11-08). Outline itself: **assumed**.

```markdown
# <Company>: leaving Airtable

Status: draft · <date> · prepared from your base by airtable-exit

## Verdict
One line: stay / clean up / move, and why.

## Bill now vs after
| | Now (Airtable) | After (own app) |
|---|---:|---:|
| Seats / hosting | <n editors × $price> | Supabase Pro $25 + Vercel Pro $20 × <dev seats> |
| Other tools (stated) | | |
| Total per month | | |
Seats with no recorded activity: <n>. Sources: Airtable, Supabase, Vercel pricing pages (<date>).

## What we found
Tables (records, last activity, fill) · fields by type · links diagram · formulas (count, how many have no SQL twin) ·
automations (on/off, trigger, external steps) · interfaces (pages, users) · extensions · forms · synced tables ·
attachments (files, GB).

## What you actually use
Active vs dead tables and fields · where the daily work happens · outside users.

## How you work
Each process in plain words: who does what, when, with which automation. (Drafted by the agent, corrected by you.)

## Other tools connected
Tools that read or write the base, and what breaks when record ids change.

## What moves, what is dropped, what is rebuilt
Three short lists with reasons.

## Risks
Data quality counts, limits close to the cap, script code to rewrite, guessed rollups, missing view filters.

## Plan, effort and dates
Steps with effort from the rule table · parallel run · cutover date · Airtable read-only for 30 days, then downgrade.

## What we need from you
Checklist: screenshots, script code, tool list, outside users, cutover date, approval.
```
