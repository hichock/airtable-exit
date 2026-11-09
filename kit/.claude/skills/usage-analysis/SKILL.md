---
name: usage-analysis
description: ALWAYS use this skill when the owner asks what they actually use in Airtable, which fields or tables are dead, who works in which table, which seats are unused, how clean the data is, or what not to migrate. Also run it right after discover. It turns kb/airtable/inventory.json into kb/airtable/usage.md with fill rates, activity per month, stale tables, dead fields and views, data-quality flags, seats without activity, and a proposed don't-migrate list.
---
# Usage analysis

Read kb/RULES.md, kb/context.md, kb/airtable/inventory.json and kb/airtable/inventory.md first.
Signal rules: [references/signals.md](references/signals.md).

Inputs only. No new Airtable calls unless a number is missing; then say which call you made.

## 1. Per table
From `bases[].tables[].usage` in inventory.json:
- records, created per month (last 12), first and last created, `modifiedLast90d` (null if not measured).
- Stale if no record created in 90 days AND `modifiedLast90d` is 0 or null AND no automation uses the table.
- Attachments: files, MB, largest file and files over 50 MB (`attachments.largestBytes`, `overLimit`). Compare with
  Supabase Free (50 MB per file, 1 GB in total). Over the limit → a line for the plan: link from existing storage, or
  upgrade (plan/references/prices.md).
- Duplicates in the primary field (`duplicatePrimary`), and comment-heavy tables (`commentRecords`).

## 2. Per field
For every field compute and list:
- `fillRate` (empty cells are omitted by the API, so presence = fill).
- Referenced? It appears in any formula/lookup/rollup's `referencedFieldIds`, `recordLinkFieldId` or
  `fieldIdInLinkedTable`.
- Visible? It appears in any shared grid view's `visibleFieldIds`.
- Used by an automation? Its table and field name appear in `automations[]` trigger or step inputs.
- Dead-field score: fill < 5% AND not referenced AND not visible AND not used by an automation → "propose drop".
- Formula `isValid: false` → "broken formula".
- Type smells (assumed, check by sampling 20 records with `cellFormat=string`): emails or phones in text fields,
  numbers stored as text, dates as text.

## 3. Views and interfaces
- Personal views (`personalForUserId`): count per table; they are not migrated by default.
- Views with very few visible fields or duplicated names: flag as "probably unused" (assumed).
- Interfaces never published (`firstPublishTime` empty): flag.

## 4. People and seats
From `bases[].people` (counts) and `.migrate/people.json` (`activityByTable`, never copy emails into kb):
- Seats by level (owner/create/edit/comment/read/interfaceOnly).
- Editors with no `createdBy`/`lastModifiedBy`/collaborator activity: count them as "seats with no recorded
  activity". Say that the API only shows activity in those field types, so this is a lower bound.
- Outside-looking users (interface-only, read) → question for the owner, not a conclusion.

## 5. API budget check
Records ÷ 100 = calls for one full copy, per table. Add the nightly delta for a 2–4 week parallel run
(records modified per day ÷ 100, minimum 1 call per table per night). On Team, compare with 100,000/month.

## 6. Write kb/airtable/usage.md
Status: draft, date. Sections: Summary (5 lines max) · Tables · Fields to drop (proposed, with the four reasons) ·
Broken formulas · Data quality · Views and interfaces · Seats · API budget · Open points (for the plan's gaps).
Label: counts are `measured` (with date and n); smells and staleness are `assumed`.
The drop list is a proposal. The `plan` skill applies it only after the owner approves.

## 7. Tell the owner
Three lines: what is used, what looks dead (counts), and any risk (budget, data quality, file limits). Then run
`/process-map` (during setup, without waiting).

Write kb/runs/<YYYY-MM-DD>-usage-analysis.md; update kb/README.md status (usage: draft).
