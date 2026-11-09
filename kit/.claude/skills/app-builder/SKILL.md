---
name: app-builder
description: ALWAYS use this skill when the owner wants pages, views or dashboards changed or built: "make it look like our interface", "add a view", "build the dashboard", "show deals by stage", "a page for clients", "add a form", "change the columns", "make it work on my phone". It configures app.schema.json (grid, kanban, calendar views, forms, dashboard tiles and charts) and builds custom pages only when config is not enough, checked with screenshots at 1280 and 390 px.
---
# App builder

Read kb/RULES.md, kb/context.md, kb/processes.md, kb/airtable/interfaces.md, kb/schema.md and kb/dev-rules.md
(sections 3 and 7) first. Config reference: [references/app-schema.md](references/app-schema.md).

## 1. Config first
Most of what Airtable views and interfaces do is config in `app.schema.json`:
- **Views** (per table): `grid` (columns, filters, sorts), `kanban` (`by` a select field, `cardFields`),
  `calendar` (`by` a date field). One view per Airtable view the team uses; names as the team knows them.
- **Forms**: `forms[]` with `fields`; `public: true` serves it at `/forms/<key>` without login (link and people
  fields are hidden on public forms). Tell the owner which website embeds must change to the new URL.
- **Dashboards**: one per interface dashboard page. `tiles` (count/sum/avg with filters) for the headline
  numbers, `charts` (bars grouped by a select or text field, count or sum) for breakdowns. Max 6 tiles, 4 charts.
- **Roles**: `roles[]` decides which tables each role sees in the menu and can edit.
After each change: `npm run schema:check`.

## 2. From interfaces (MCP pages, plus screenshots if the owner sent any)
Work from what discover read (page names, types, tables, form schemas) and the plan's defaults. Don't wait for
screenshots: build the default (one dashboard per interface page), show the preview, and improve when screenshots
arrive. For each page in kb/airtable/interfaces.md: list its elements (numbers, charts, lists, filters, buttons). Map each
to a tile, chart, view or form. What can't be config (a button that runs a script, a custom layout) becomes a
custom page or an automation. Write the mapping in kb/airtable/interfaces.md ("→ dashboard overview, tile 2").

## 3. Custom pages (only when config can't do it)
Follow kb/dev-rules.md §3: `app/(app)/<area>/page.tsx` (≤ 40 lines: guard, params, loader, view model, render) →
loader in `lib/loaders.ts` (reads via `session.store`, throws "Could not load …") → pure view model in
`lib/views/<x>-view.ts` with `<x>-view.test.ts` (literal expected values) → components in `components/`.
Use `requireUser()` and `can(session, table, "write")`; writes go through `app/actions.ts` (parse → load →
decide → write). Reuse tokens in `app/globals.css` and `CellView`, `GridTable`, `KanbanBoard`.

## 4. Check it
```bash
npm run typecheck && npm test && npm run build
DEMO=1 npm run dev   # or a preview deploy with real data
```
Screenshot each changed page at 1280×800 and 390×844 (Playwright: `npx playwright screenshot --viewport-size=1280,800 <url> out.png`).
Look at them: no sideways scroll at 390, long names truncate, empty and error states read well, chips have colour.
Fix what looks wrong before showing the owner. Say what you did not check (e.g. "not seen with real data").

## 5. Ship
Branch → push → Vercel preview → send the owner the link and what to check → merge after OK (kb/dev-rules.md §1).
Record UI choices in kb/decisions.md.

Write kb/runs/<YYYY-MM-DD>-app-builder.md; update kb/README.md status.
