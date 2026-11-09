---
name: discover
description: ALWAYS use this skill when the owner asks what is in their Airtable, wants the base scanned or inventoried, asks "what do we have", "how big is it", "which automations do we run", "who has access", or when setup reaches the discovery step. It reads every table, field, formula, view, record count, attachment size, collaborator level, interface, automation, extension, webhook and connected account (read-only) and writes kb/airtable/inventory.md and inventory.json. Do not describe the base from memory; run this.
---
# Discover the Airtable base (read-only)

Read kb/RULES.md, kb/context.md and kb/airtable/README.md first. Facts and limits: [references/endpoints.md](references/endpoints.md).

Never write to Airtable. Never copy record contents, emails or comment text into `kb/` (RULES.md → Airtable-specific).

## 1. Check access
- Token: `.env.local` has `AIRTABLE_PAT` and `AIRTABLE_BASE_ID`. Test:
  `curl -s -H "Authorization: Bearer $AIRTABLE_PAT" https://api.airtable.com/v0/meta/whoami` → `{"id":"usr…"}`.
- MCP, first match wins: (a) Airtable tools already in this session (plugin `airtable@claude-plugins-official`,
  hosted MCP, or a claude.ai connector). Tool names are prefixed (e.g. `mcp__plugin_airtable_airtable__list_bases`);
  match on the ending. (b) No tools, but a token: the Airtable MCP CLI with the same token,
  `npm i -g @airtable/mcp-cli`, then `AIRTABLE_TOKEN="$AIRTABLE_PAT" airtable-mcp tools` lists the tools and
  `airtable-mcp <tool> --json` calls one (arguments as JSON on stdin with `--input -`; check names with `tools`).
  Write tools are denied in `.claude/settings.json`; never call them, also not through the CLI.
- Ask the owner nothing here. If more than one base is readable and kb/context.md does not say which moves, read
  them all at schema level and let the plan propose which to move.
- Budget: estimate calls before reading. Records ÷ 100 per table, plus about 10 per base, plus the same again if
  `--activity` is used. On Airtable Free (1,000 calls/month) or Team (100,000/month) say the estimate to the owner
  first. MCP calls count against the same limits.

## 2. REST pass (schema, people, views, counts, usage)
```bash
set -a; . ./.env.local; set +a
npm run airtable:inventory -- $AIRTABLE_BASE_ID --activity
```
This calls, per base: `GET /v0/meta/bases/{id}?include=collaborators&include=interfaces&include=inviteLinks`,
`GET /v0/meta/bases/{id}/tables?include=visibleFieldIds`, `GET /v0/meta/bases/{id}/views`,
`GET /v0/meta/bases/{id}/blockInstallations`, `GET /v0/bases/{id}/webhooks` (only works with `webhook:manage`;
a 403 there is fine), and pages every table at 100 records per call (5 calls/s, waits 30 s on a 429).
It writes `kb/airtable/inventory.json` (no emails, no record data) and `.migrate/people.json` (gitignored).
Read the `notes` array: endpoints that failed and why. Put each in inventory.md under "Not read".

No token yet? Use the MCP tools instead and write the same shape by hand: list bases, list tables (schema),
`list_views_for_table`, `list_records_for_table` for counts only. Say in inventory.md that counts came from MCP.

## 3. MCP pass (what REST cannot read)
For each base, call and add to that base's object in `inventory.json`:
1. `list_automations` → for each id, `get_automation`. Keep: name, on/off (deployment status), trigger type and
   table, each step's type and target (table, Slack channel, email recipient type, webhook host), and whether a
   step runs a script. Do not copy email bodies or recipient addresses. Key: `"automations": [...]`.
2. `list_pages_for_base` → interface pages (name, type: dashboard / record list / overview). For forms in
   interfaces, `get_form_schema` (fields, required, visibility rules). Key: `"interfacePages": [...]`.
3. `list_external_accounts` → connected services (Slack, Google, …) as types only. Key: `"externalAccounts"`.
If a tool is missing or fails (permissions: the connecting person should be owner or creator), write the error
under "Not read". process-map turns it into a gap with a best guess; the plan shows it. Do not ask the owner now.

## 4. Find the external glue (draft, owner confirms later)
List every sign of another tool touching the base: automation steps with webhooks or "when webhook received"
triggers, webhook hosts, button fields (type `button`; URL domains), fields named like Zapier/Make/Last sync,
synced tables (`externalSyncSource` field), extensions (`blockSlug`), records created by integration users
(`createdBy` names in `.migrate/people.json` activity). Polling tools (Zapier, Make) leave no trace: say so.

## 5. Write kb/airtable/inventory.md
Status line, date, access method. Then per base, in this order (keep it under ~200 lines; split per base if bigger):
1. Summary: tables, records, fields, attachments (files, GB), automations (on/off), interfaces, people by level.
2. Tables: one row each: name (`tbl…`), records, fields, created per month (last 6), last created, modified in
   90 days, attachment MB, duplicates in primary field.
3. Fields by type (counts) and the formulas: name, text, referenced fields, valid or not.
4. Links graph as a Mermaid `erDiagram` (table → table via link field; mark single vs multiple).
5. Views: per table, name, type, personal or shared, visible field count. Note: filters/sorts/groups are not exposed.
6. Automations: name, on/off, trigger, steps, external calls, script yes/no. Also write `kb/airtable/automations.md`
   with one row each and a `Rebuild:` column left empty for automations-rebuilder.
7. Interfaces: name, pages, who can open (counts by level), first published.
8. People: counts by permission level and via (base, workspace, group, interface). Group members are not expanded.
9. External connections (step 4), each labelled `measured` (seen in API) or `assumed`.
10. Not read (and why). These become gaps with best guesses in process-map, not questions.
Label numbers `measured` with today's date. Unknown field types: list them; never crash on them.

## 6. Tell the owner
Three lines: size (tables, records, GB, largest file), moving parts (automations, interfaces, integrations), and
what could not be read. Then run `/usage-analysis` (during setup, without waiting).

Write kb/runs/<YYYY-MM-DD>-discover.md (calls used, errors, what's next); update kb/README.md status
(inventory: draft). Setup ticks its "Base read" step after process-map.
