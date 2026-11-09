# Testing airtable-exit yourself

Two ways: a **dry run** on demo data that needs no accounts (15 minutes), and a **full run** with free accounts and
a sample Airtable base (about an hour, not measured yet). Write what you find to the repo's issues or tell Claude
"help" in the session (it sends the problem to the author).

## A. Dry run on demo data (no accounts)

Checks the app, the bundle's files and the agent flow up to the plan, with a fake inventory.

```bash
git clone https://github.com/hichock/airtable-exit && cd airtable-exit   # gh auth login first while it is private
claude plugin validate .                                                 # plugin and marketplace files are valid
cd template && npm ci && npm test && npx tsc --noEmit                    # unit tests and types
npm run demo                                                             # open http://localhost:3000
```
In the demo app check: grid (sort, filter, inline edit), kanban (drag a card), calendar, a record page, a form,
the dashboard, the System page, and the same at phone width (390 px). Demo data is invented.

Then the kit and the agent flow, still without accounts:
```bash
cd .. && bash scripts/scaffold.sh /tmp/aex-dry && cd /tmp/aex-dry && npm install && git init -q
mkdir -p kb/airtable .migrate && cp scripts/schema-from-airtable/fixtures/inventory.sample.json kb/airtable/inventory.json
npm run schema:from-airtable -- kb/airtable/inventory.json --out .migrate/app.schema.draft.json --notes .migrate/schema-notes.md
```
Open Claude Code in `/tmp/aex-dry` and check:
1. The session-start hook prints the knowledge base map and "Setup is not finished".
2. Say "what's in our Airtable?" with no token: `discover` should say it has no access and point to the token guide,
   not invent anything.
3. Say "plan it": `plan` should write `kb/report.md` from the sample inventory with gaps and best guesses, cost on
   free tiers, and ask exactly one question (approve or comment). `npm run report:html` renders `docs/report.html`.
4. Say "help, the import fails": `get-help` should show a summary without secrets, ask whether your contact details
   are current, and only send after you say yes. To test without sending, answer "no".
5. If Postgres is installed: `npm run test:migrations` (migrations and access rules on a throwaway database).

## B. Full run with free accounts

### Before you start
| Need | How | Cost |
|---|---|---|
| Airtable account with a sample base | Sign up at airtable.com, open airtable.com/templates, pick a CRM-like template (e.g. a sales pipeline), click **Use template**. Add 2 or 3 records with a file attached, one automation, and one interface page, so every reader has something to find. | Free plan: 1,000 API calls per workspace per month. A small base uses a fraction of that; check the estimate discover prints. |
| GitHub | Account, `gh auth login` (the bundle repo is private for now) | Free |
| Supabase | Account (Continue with GitHub). Optional: Supabase connector in claude.ai → Settings → Connectors | Free (2 active projects) |
| Vercel | Account on Hobby (Continue with GitHub). Optional: Vercel connector | Free |
| Claude Code | On your computer, or claude.ai/code for the cloud path | Your plan |

### Install
On your computer, in an empty folder:
```text
/plugin marketplace add hichock/airtable-exit
/plugin install airtable-exit@lowcoding-airtable
/airtable-exit:setup
```
Or without the plugin: `bash <path-to-clone>/scripts/scaffold.sh my-crm` and tell Claude "follow
<path-to-clone>/skills/setup/SKILL.md".
Cloud path: create an empty private repo, start a claude.ai/code session on it, type
`Set up airtable-exit from github.com/hichock/airtable-exit`. Test once more on a repo that already has files: setup
must ask about `crm/` or a new repo, and nothing else.

### What to check at each phase
| Phase | Pass if |
|---|---|
| 1. Detect | One table of ready / one click / missing. No questions. Connectors you turned on are listed and used later. |
| 2. Folder | Local empty folder used without asking. Cloud: empty repo used; repo with files → exactly one question. |
| 3. Airtable | Only the token is asked for, with the guide link. `whoami` passes. Token never shown in the chat or `kb/`. |
| 4. Read | `kb/airtable/inventory.md` has your tables, the automation (if the MCP read worked) and the interface page. `usage.md` has fill rates and the largest file. No emails or record contents in `kb/` (`grep -rn "@" kb/`). |
| 5. Plan | One report: found, moves as is, gaps with best guesses, improvements, cost $0 on free tiers, effort table. One question. Comment on one line and check only that line changes. |
| Safety | Ask Claude to "add a test record in Airtable": it must refuse; the Airtable create tool is denied by `.claude/settings.json`. |
| 6. GitHub | Private repo (or the cloud repo) has the commit. No `.env.local` in git (`git ls-files | grep env`). |
| 7. Supabase | Free project, all migrations applied, keys only in `.env.local` or environment settings. |
| 8. Vercel | Live URL, `/api/health` says `"mode":"supabase"`. Env vars set without Airtable ones. |
| 9. Admin | Sign-in email arrives, you can sign in, System page shows you as admin. |
| Copy | `/roles-and-access` then `/data-migrator`: counts match, the file opens in the app, `npm run migrate:parity` is green. Attach a file over 50 MB in Airtable once: it must be skipped and listed, not crash the copy. |
| Parallel run | `/sync-and-cutover` phase 1: nightly sync runs (System page). Delete one record in Airtable: parity lists it as `extra`. |
| Help | Say "help": summary has no secrets, contact confirmed, request id written to `kb/runs/`. |

Write each result (pass / fail / note) somewhere you keep; failures are findings for the next version.

### Reset
- Re-run one step: open `kb/setup-state.md`, change its `[x]` back to `[ ]`, run setup again.
- Start over: delete the Supabase project (**Project Settings → General → Delete project**), the Vercel project
  (**Settings → Advanced → Delete Project**), the GitHub repo (**Settings → Danger Zone → Delete this repository**),
  the Airtable token (airtable.com/create/tokens → the token → **Delete**), and the local folder.
- Plugin: `/plugin uninstall airtable-exit@lowcoding-airtable`, then `/plugin marketplace remove lowcoding-airtable`.
- The Airtable sample base is never changed by the bundle. Delete it in Airtable if you like.
