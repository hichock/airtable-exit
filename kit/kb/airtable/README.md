# Airtable folder

What we learned about the Airtable base. Schema and counts only: no record contents, no emails (see RULES.md).

| File | Written by | Contents |
|---|---|---|
| inventory.json | discover | Machine-readable: bases, tables, fields (types, options, formula text), views, record counts, attachment bytes, automations, interfaces, extensions, webhooks, people counts by permission level. Input to `npm run schema:from-airtable`. |
| inventory.md | discover | The same, for people: one section per base |
| usage.md | usage-analysis | Fill rate per field, activity per month, stale tables, dead fields and views, don't-migrate list |
| automations.md | discover / automations-rebuilder | Each automation: trigger, steps, external calls, rebuild target, status |
| interfaces.md | process-map / app-builder | Each Interface page in words (from MCP + owner screenshots) |

Raw API responses, people lists and screenshots go to `.migrate/` (gitignored), never here.
