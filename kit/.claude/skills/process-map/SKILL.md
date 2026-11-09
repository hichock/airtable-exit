---
name: process-map
description: ALWAYS use this skill when the owner asks how their team works in Airtable, what each automation or interface is for, who does which step, or right after usage-analysis. It reads the inventory (automations, interfaces, views, people, activity) and drafts the business processes in plain words ("lead → deal → invoice") in kb/processes.md, without asking the owner anything. Everything it cannot see becomes a gap with a best guess and a way to handle it, which the plan skill puts in front of the owner for one approval.
---
# Process map (no questions)

Read kb/RULES.md, kb/context.md, kb/airtable/inventory.md, kb/airtable/automations.md and kb/airtable/usage.md first.
Gaps and default guesses: [references/questions.md](references/questions.md).

Do not ask the owner questions here. Draft from the data, guess where you must, label the guess, and move on.
The owner corrects the draft once, when they read the plan.

## 1. Draft the processes from the data
A process is a chain of work that moves records through states. Find them from:
- Select fields that look like stages (Status, Stage, Phase) and the kanban views grouped by them.
- Link chains (e.g. Companies → Deals → Invoices) in the links graph.
- Automations: each trigger is a step boundary ("when Stage becomes Won → create Invoice, notify Slack").
- Interfaces: who uses which page (counts by level) tells you which role does which step.
- Activity: tables with the most records created per month are where daily work happens.

For each process write in `kb/processes.md` (format is in the file's comment): trigger, steps (role, table or
interface, what changes), automations, external tools, data, pains, and "In the new app" (page, automation, role).
Mark each line `measured` (seen in data) or `assumed` (your reading).

## 2. List the gaps, each with a best guess
For every item in [references/questions.md](references/questions.md) that the data does not settle, write one line in
`kb/processes.md` → "Gaps": what is unknown, your best guess (labelled `assumed`), how the build handles it if
nobody answers, and what would make it better (for example "a screenshot of the Sales interface").
Also add what discover could not read (its "Not read" list).
Never block on a gap. The default handling must let the build go on.

## 3. Owner-supplied files, if they come
If the owner offers screenshots or script code (now or later), take them: files go to `.migrate/screenshots/` or
`.migrate/scripts/` (gitignored). Describe each screenshot in words in `kb/airtable/interfaces.md` (layout,
filters, sorts, numbers shown), without personal data. Update the matching gap to `stated`.

## 4. Tell the owner
One line per process and the number of gaps. Say: "I'll put these in the plan with my best guesses; you can
correct anything there." Then run `/plan`.

Write kb/runs/<YYYY-MM-DD>-process-map.md; update kb/README.md status (processes: draft)
and tick step 4 (Base read) in kb/setup-state.md if setup is running.
