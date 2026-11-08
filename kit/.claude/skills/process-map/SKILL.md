---
name: process-map
description: ALWAYS use this skill when the owner asks how their team works in Airtable, what each automation or interface is for, who does which step, or when the discovery needs the owner's answers. It turns the inventory (automations, interfaces, views, people) into plain-language processes like "lead → deal → invoice" in kb/processes.md, and asks the owner at most 8 questions for what the API cannot see (screenshots, script code, Zapier/Make, outside users, pains), saving answers in kb/context.md.
---
# Process map

Read kb/RULES.md, kb/context.md, kb/airtable/inventory.md, kb/airtable/automations.md and kb/airtable/usage.md first.
Questions: [references/questions.md](references/questions.md).

## 1. Draft the processes from the data
A process is a chain of work that moves records through states. Find them from:
- Select fields that look like stages (Status, Stage, Phase) and the kanban views grouped by them.
- Link chains (e.g. Companies → Deals → Invoices) in the links graph.
- Automations: each trigger is a step boundary ("when Stage becomes Won → create Invoice, notify Slack").
- Interfaces: who uses which page (counts by level) tells you which role does which step.
- Activity: tables with the most records created per month are where daily work happens.

For each process write in `kb/processes.md` (format is in the file's comment): trigger, steps (role, table or
interface, what changes), automations, external tools, data, pains, and "In the new app" (page, automation, role;
fill later). Mark each line `measured` (seen in data) or `assumed` (your reading).

## 2. Ask the owner (max 8 questions, one at a time)
Use the table in references/questions.md. Before each question, show your draft answer from the data and ask
"what's wrong or missing?". Skip questions already answered in `kb/context.md`.
- Screenshots and script code: ask the owner to drop files in `.migrate/screenshots/` or paste code. Describe each
  screenshot in words in `kb/airtable/interfaces.md` (layout, filters, sorts, numbers shown). No personal data.
- Write each answer to `kb/context.md` under its heading, labelled `stated` with the date.
- New rules from answers ("never email clients automatically") go to `kb/decisions.md`.

## 3. Fill the gaps
After the answers, update `kb/processes.md`: confirmed lines become `stated`; add the external tools the owner
named to `kb/context.md` → Tools, with "reads/writes" and "breaks when record ids change: yes/no".
Anything still unknown stays `needs input` and goes to the report's owner to-do list.

## 4. Tell the owner
List the processes in one line each and the open items. Suggest `/plan`.

Write kb/runs/<YYYY-MM-DD>-process-map.md; update kb/README.md status (processes: draft, context: draft)
and tick step 6 in kb/setup-state.md if setup is running.
