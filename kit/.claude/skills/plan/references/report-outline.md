# Plan for the owner: outline (one page per base + a summary)

Based on what agencies inventory before an Airtable migration (WitsCode 1-week audit; Scroll "always start with an
audit"; Softr migration checklist; read 2026-11-08). Outline itself: **assumed**. Written for a non-technical
owner: plain words, short lines, a default for every open point. The owner answers by approving or commenting.

```markdown
# <Company>: leaving Airtable

Status: draft · <date> · prepared from your base by airtable-exit

## In short
One line: stay / clean up / move, and why. One line: what it costs after. One line: what we need from you
(approve, or comment on any line below).

## Bill now vs after
| | Now (Airtable) | After (own app, free tiers) |
|---|---:|---:|
| Seats / hosting | <n editors × $price> | Supabase Free $0 + Vercel Hobby $0 |
| Other tools (stated) | | |
| Total per month | | |
Free limits checked against your data: files over 50 MB: <n>, files total <GB> of 1 GB, database estimate <MB>
of 500 MB. For each limit hit: what we'll do (link big files from your existing storage) and the paid option.
Seats with no recorded activity: <n>. Sources: Airtable, Supabase, Vercel pricing pages (<date>).

## What we found
Tables (records, last activity, fill) · fields by type · links diagram · formulas (count, how many have no SQL twin) ·
automations (on/off, trigger, external steps) · interfaces (pages, users) · extensions · forms · synced tables ·
attachments (files, GB, largest).

## What moves as is
Tables, views, forms, automations and roles that map one to one. A short list with counts.

## What we drop
Dead tables and fields, personal views, broken formulas. Each with its reason and the number behind it.

## Missing or unclear, and what we'll do
| What | Our best guess | What we'll do if you say nothing | Better with (optional) |
|---|---|---|---|
One row per gap (view filters, interface layouts, script code, other tools, outside users, guessed rollups…).

## What the new app can do better (optional)
Only items the data gives a reason for, each with the evidence and its effort. You can tick or skip each one.

## How you work
Each process in plain words: who does what, when, with which automation. (Drafted by the agent from your data.)

## Other tools connected
Tools seen in the data, and what breaks when record ids change. "Possible" ones are marked.

## Risks
Data quality counts, limits close to the cap, script code to rewrite, guessed rollups, missing view filters,
deletes during the parallel run.

## Plan, effort and dates
Steps with effort from the rule table · parallel run · cutover date (proposed) · Airtable read-only for 30 days,
then downgrade.

## Your answer
Approve, or comment on any line. Files that make it better (screenshots, script code) can come at any time.
```
