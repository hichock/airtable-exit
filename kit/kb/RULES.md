# Knowledge base rules

The knowledge base (`kb/`) is this system's memory. Every skill reads it before working and writes to it after.
These rules apply to every session, every skill and every scheduled run.

## Read
1. **Start of every session:** read `kb/README.md` (the map). Then read only the files your task needs.
2. **Before any task:** read `kb/context.md` (company, people, tools, rules). Never ask the owner something
   that is already written there.

## Write (in the same session, never "later")
| When | Write to | Format |
|---|---|---|
| Something is decided (a rule, a choice between options, a "don't do X", an owner's correction) | `kb/decisions.md` | newest first: `date — decision — why — where` |
| You research something | `kb/research/<topic>-<YYYY-MM>.md` + a line in `kb/research/README.md` | "Key takeaways" first, dated sources at the end |
| A skill or scheduled job runs | `kb/runs/<YYYY-MM-DD>-<skill>.md` | what ran, numbers, cost, errors, what's next (10 lines max) |
| Something breaks or surprises you | `kb/findings.md` | `F-<n> date — what happened — cause — fix — how we'll notice next time` |
| A plan or project changes status | its own file's `Status:` line + the map in `kb/README.md` | |
| A fact about the business changes (new tool, new person, new price) | `kb/context.md` or the domain file | edit in place, date the line |
| The owner answers a question | `kb/context.md` (or the file that asked) | the answer, labelled `stated`, dated |

## How to write
- **Label every number and claim:** `measured` (from our own run, with n and date), `sourced` (named source + link +
  date), `stated` (the owner said it), `assumed` (our judgement), `needs input` (only the owner can answer).
  Never invent numbers. If you don't know, write `needs input` and ask once.
- **One fact lives in one place.** Link to it instead of copying it. Two copies drift apart.
- **Supersede, never delete.** Mark the old line `Superseded YYYY-MM-DD by …` so the history stays readable.
- **Keep files short** (under ~200 lines). Split by topic when a file grows. Short sentences, plain words.
- **Owner corrections become rules.** When the owner corrects you, add the rule to `decisions.md` so it never
  happens twice.
- **No secrets** (API keys, tokens, passwords) and **no personal data exports** (lists of names, emails, phones)
  in `kb/`. Aggregates and counts only; raw data stays in the database. One exception: the owner's own contact
  in `kb/context.md` → "Owner contact", written with their OK, for help requests.

## Airtable-specific
- **Schema is fine, records are not.** Table, field, view and option names may go in `kb/`. Record contents,
  collaborator emails and comment text may not. People lists for invites go to `.migrate/people.json` (gitignored).
- **Screenshots** the owner shares go to `.migrate/screenshots/` (gitignored). Describe what they show in
  `kb/airtable/interfaces.md` in words (layout, filters, numbers shown), without personal data.
- **Airtable ids are the join key.** Write `tbl…`/`fld…`/`viw…` ids next to names, so a rename doesn't break a link
  between files.
- **Airtable stays read-only for us.** Never write to it from a skill.

## Maintain
- The `kb-tidy` skill runs weekly (or on "tidy the knowledge base"): merges duplicates, fixes the map, archives runs
  older than 60 days into `kb/runs/archive/`, and lists open `needs input` items for the owner.
