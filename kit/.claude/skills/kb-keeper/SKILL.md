---
name: kb-keeper
description: ALWAYS use this skill when the owner decides something, corrects you, says "remember", "from now on", "don't do X", "we chose", or when a run, research or a problem should be recorded. It writes the right line to the right file in kb/ (decisions, findings, runs, research, context). Do not edit kb/ files directly without it.
---
# Keep the knowledge base current

Read kb/RULES.md and kb/context.md first. Then:

1. Decide what kind of note this is:
   - decision or correction → `kb/decisions.md`, newest first: `- <date> — <decision> — <why> — <where in code/kb>`
   - something broke or surprised us → `kb/findings.md`: next `F-<n>`
   - a run finished → `kb/runs/<YYYY-MM-DD>-<skill>.md`
   - research → `kb/research/<topic>-<YYYY-MM>.md` + index line in `kb/research/README.md`
   - a business fact changed → edit `kb/context.md` (or the domain file) in place and date the line
2. Label numbers (`measured` / `sourced` / `stated` / `assumed` / `needs input`). Never invent numbers.
3. No secrets and no personal data (emails, names of customers, record contents). Counts only.
4. If the note replaces an older one, mark the old one `Superseded <date> by …`. Don't delete it.
5. If a plan's status changed, update its `Status:` line and the map in `kb/README.md`.
6. Commit with a message that says why (`kb: <what was decided>`).

Tell the owner in one line what you wrote and where.

Write kb/runs/<YYYY-MM-DD>-kb-keeper.md only for bulk updates (5+ notes at once); update kb/README.md status if a
file's status changed.
