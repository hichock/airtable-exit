# Gaps the API cannot settle, and the default for each

Not a questionnaire. The agent never asks these as a round of questions. For each gap it writes a best guess and a
default handling into the plan. The owner approves the plan or comments on any line.
Only two things are asked directly, because nothing else can answer them: which base(s) to move (only if there is
more than one) and the plan approval. Data-changing steps later still need a "go".

| Gap | Why the agent can't read it | Best guess from | Default if nobody answers | Optional improvement offered in the plan |
|---|---|---|---|---|
| Which bases move | A business decision | Bases list, record counts, recent activity | All bases with activity in the last 90 days | (asked directly if more than one base) |
| View filters, sorts, groups | Not in the REST API; MCP coverage unclear | View names ("Open deals", "This week"), field types, kanban grouping | Views rebuilt with columns from the API; filters guessed from the name, flagged "check" | "Send a screenshot of the views your team uses most and I'll match them exactly" |
| Interface page layout | MCP lists pages, not the full layout | Page names, page type, the tables they show | One dashboard page per interface: counts per stage, recent records | "A screenshot of each interface page makes the dashboards match" |
| Script code in automations / Scripting extension | May not come back from `get_automation`; extension code is never exposed | Step names, inputs, tables touched | Rebuilt from the step's inputs if they are clear; otherwise left off and listed | "Paste the script code and I'll port it with tests" |
| Other tools that touch the base (Zapier, Make, forms on a website) | Polling tools leave no trace | Webhook steps, button URLs, connected accounts, integration users | Listed as "seen" or "possible"; nothing breaks until cutover, where the checklist asks again | "Tell me which other tools read or write the base" |
| Outside users and what they see | "Outside" is not marked | Interface-only and read-only users | Interface-only users get the `portal` role, read-only access to the tables their interfaces show | "Tell me if clients should see only their own records" |
| Reports that matter | Importance is not in the data | Dashboards in interfaces, grouped or summed views | The dashboard tiles and charts the interfaces already have | none |
| Why move, what hurts | Opinion | Plan limits near the cap, seat counts | Cost and limits from the data | none |
| Cutover date and freeze window | Calendar and people | Activity by weekday and hour | Proposed from the quietest weekday and hour in the activity data; the date is set later | Owner confirms when they start `/sync-and-cutover` |
| Airtable plan (for the cost line) | Not in the API | Seat counts, limits hit | Team and Business shown side by side, labelled `assumed` | none |
