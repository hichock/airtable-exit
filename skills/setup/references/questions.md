# What setup may ask, and nothing more

The owner is often not technical. Moving off Airtable should feel easy, not like an exam. So setup reads, guesses
and decides by itself, and puts every open point into one plan with a best guess.

## Allowed questions (one at a time, only when nothing else can answer)
| When | Question | Only if |
|---|---|---|
| Step 2, cloud or local repo with files | "May I set up the project in `crm/` here, or would you like a new repo?" | The repo is not empty |
| Step 3 | "I'll move <base>. Also <other base>?" | More than one base has recent activity and kb/context.md doesn't say |
| Step 5 | "Approve this plan, or tell me what to change?" | Always (the gate) |
| Later skills | "Invite these people now?" · "Copy now?" · "Go" per cutover phase | Steps that change data or send emails |

## Clicks only the owner can do (not questions: say what and why, link the guide, wait, re-check)
- Create the read-only Airtable token: [guides/airtable-token.md](guides/airtable-token.md)
- Log in to GitHub, Supabase or Vercel when no connector covers it: [github](guides/github.md),
  [supabase](guides/supabase.md), [vercel](guides/vercel.md)
- Copy the Supabase secret key into `.env.local` or the environment settings: [guides/supabase.md](guides/supabase.md)
- Cloud only: allow a blocked host, add a secret, attach a new repo: [guides/claude-cloud-session.md](guides/claude-cloud-session.md)

## Not asked (goes into the plan as "best guess, better with…")
View filters, interface layouts, script code, other tools that touch the base, outside users, important reports,
pains, cutover date, the Airtable plan name. The table of gaps and defaults is in the kit:
`kit/.claude/skills/process-map/references/questions.md` (in the project: `.claude/skills/process-map/references/questions.md`).

## How
- Before any question, check `kb/context.md` and `kb/decisions.md`: never ask twice.
- Say what you will do by default, so "yes" is enough: "I'll put it in `crm/`. OK?"
- Files the owner sends (screenshots, script code) go to `.migrate/screenshots/` and `.migrate/scripts/`
  (gitignored), at any time. They improve the build; they never block it.
- Answers go to `kb/context.md` labelled `stated` with the date; rules go to `kb/decisions.md`.
