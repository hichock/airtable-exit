# Owner interview during setup

The question list lives in the project kit, so it also works without the plugin:
`kit/.claude/skills/process-map/references/questions.md` (in the project: `.claude/skills/process-map/references/questions.md`).
Setup step 6 runs `/process-map`, which asks them. These are the rules for how setup handles the interview.

- **When:** after discover and usage-analysis, so every question comes with a draft answer from the data.
- **How many:** at most 8. Skip any already answered in `kb/context.md`.
- **How:** one question at a time. Show the draft ("From your base I see 3 interfaces used by 2 outside users…"),
  then ask "what's wrong or missing?". Accept "skip"; mark the item `needs input`.
- **Files:** screenshots and script code go to `.migrate/screenshots/` and `.migrate/scripts/` (gitignored).
  The agent describes them in words in `kb/airtable/interfaces.md` and `kb/airtable/automations.md`.
- **Where answers go:** `kb/context.md`, labelled `stated` with the date. New rules go to `kb/decisions.md`.
- **Time:** aim for 5 minutes. If the owner is busy, finish the report with the gaps listed in "Owner to-do" and
  continue; the plan approval gate still applies.
