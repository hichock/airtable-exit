# Owner questions (max 8)

Ask only what the API and MCP cannot read. Draft each answer from the data first. One at a time.

| # | Ask | Why the agent can't read it | Draft from |
|---|---|---|---|
| 1 | Which bases move, which stay, and what is the target date? | A business decision | Bases list, record counts |
| 2 | Please share screenshots of each Interface page and the 3–5 views your team uses most (with filters visible). | View filters, sorts, groups and colours are not in the API; MCP can't read interface layouts | Interface names and users; grid views with the most visible fields |
| 3 | Do any automations run scripts, or do you use the Scripting extension? Please paste the code. | Script code may not come back from `get_automation`; extension code is not exposed | Automation steps of type script; extensions list |
| 4 | Which other tools read or write this base (Zapier, Make, n8n, website forms, accounting)? | Polling integrations leave no trace in the API | Webhook steps and triggers, connected accounts, button URLs, integration users |
| 5 | Who outside your company uses it (clients, contractors), and what should each see? | Portal users need Enterprise; "outside" is not marked | Interface-only and read users |
| 6 | Which numbers or reports do you check every week? | Importance is not in the data | Interface dashboards, grouped or summed views |
| 7 | What hurts most today: cost, speed, limits, mistakes, something else? | Opinion | Limits close to the plan cap |
| 8 | When can the team stop editing Airtable for an hour or two (the freeze), and who tells the team? | Calendar and people | Activity by weekday from createdTime |
