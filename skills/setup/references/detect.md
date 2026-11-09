# Detect before asking

Setup step 1 runs these checks and step 2 follows "Where the project goes". Print names and yes/no only, never
values. Labels: **sourced** = vendor docs, read 2026-11-09; **assumed** = our judgement, test it.

## Session type
| Check | Means |
|---|---|
| `[ "$CLAUDE_CODE_REMOTE" = "true" ]` | Cloud session (claude.ai/code or the app's cloud mode). The repo was chosen when the session started. **assumed**: this variable is set in cloud sessions (seen 2026-11-09) |
| otherwise | Local session on the owner's computer |

## Repo
```bash
git rev-parse --show-toplevel 2>/dev/null          # inside a git repo?
git remote get-url origin 2>/dev/null              # which GitHub repo
git ls-files | grep -vE '^(README(\.md)?|LICENSE|\.gitignore|\.gitattributes)$' | wc -l   # 0 = empty for us
```
"Empty" = no tracked files besides README, LICENSE, .gitignore, .gitattributes.

## Connectors and MCP tools in this session
Look at your own tool list. Tool names carry a server prefix; match on the part after the last `__`.
| Service | Tool names to look for (examples) | Use for |
|---|---|---|
| Airtable | `list_bases`, `get_table_schema`, `list_automations` (prefix contains `airtable`) | Discovery's MCP pass |
| Supabase | `create_project`, `apply_migration`, `list_migrations`, `get_project_url`, `get_publishable_keys` | Step 7 |
| Vercel | `create_project`, `create_project_env`, `create_deployment`, `list_projects` | Step 8 |
| GitHub | `create_repository`, `push_files`, `get_me` | Step 6 (local), repo checks |
A connector is preferred over a CLI: no install, no login in a terminal. Before a connector creates anything that
could cost money, say what it creates and that it is a free plan.

## CLIs and logins
```bash
node -v                      # 20.11 or newer
git --version
gh auth status 2>&1 | head -3            # GitHub CLI and login
supabase --version && supabase projects list >/dev/null 2>&1 && echo supabase-logged-in
vercel --version && vercel whoami 2>/dev/null
command -v airtable-mcp                  # Airtable MCP CLI (optional)
command -v psql pg_ctl                   # local Postgres for npm run test:migrations (optional)
```
In a cloud session, `gh` may be present and talk to GitHub through the session's proxy, but it cannot create
repositories there (assumed: the session's GitHub access is limited to the attached repo).

## Env names present (never print values)
```bash
for k in AIRTABLE_PAT AIRTABLE_BASE_ID NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CRON_SECRET SUPABASE_ACCESS_TOKEN VERCEL_TOKEN; do
  v="${!k}"; [ -z "$v" ] && [ -f .env.local ] && v=$(grep -E "^$k=." .env.local | head -1)
  [ -n "$v" ] && echo "$k: set" || echo "$k: missing"
done
```

## Network (cloud sessions)
A cloud environment may block hosts. Test the ones the steps need (any HTTP status means reachable; a refusal
from the proxy means blocked):
`curl -s -o /dev/null -w '%{http_code}\n' https://api.airtable.com/v0/meta/whoami` (401 = reachable),
the same for `https://mcp.airtable.com/mcp`, `https://api.supabase.com`, `https://api.vercel.com`,
`https://jobsearch-roan-ten.vercel.app/api/support`.
Blocked → [guides/claude-cloud-session.md](guides/claude-cloud-session.md) → "Network".

## Airtable
| Found | Do |
|---|---|
| `AIRTABLE_PAT` set and `whoami` works | Use it for REST, the copy and (via the MCP CLI) automations |
| Airtable MCP tools in the session | Use them for the MCP pass; the token is still needed for the bulk copy |
| Neither | Owner creates a read-only token: [guides/airtable-token.md](guides/airtable-token.md) |

## Where the project goes
| Where we run | Repo state | Do |
|---|---|---|
| Cloud | Empty | Use the repo root. No question. |
| Cloud | Has files | Ask once. Options: (a) a folder `crm/` in this repo (Vercel's Root Directory is then `crm`); (b) the root, only if nothing would clash (no `package.json`, `app/`, `supabase/` at the root; scaffold never overwrites but a mixed root is confusing); (c) a new repo: the owner creates it on github.com and attaches it to the session ([guide](guides/claude-cloud-session.md)). You cannot create a repo from a cloud session. |
| Local, `gh` logged in | Current folder empty, or not a repo | Use it (or a new subfolder named after the base). Create the private repo after approval: `gh repo create <name> --private --source . --push`. |
| Local, `gh` logged in | Current folder is a repo with files | Same question as cloud, plus option (d): a new folder next to it and a new private repo. |
| Local, no `gh` login | any | Use the folder now. At step 6: the GitHub connector if present, else the owner logs in once ([guide](guides/github.md)). |
**Project in a subfolder (`crm/`):** Claude Code reads `.claude/settings.json` from the session's project root, so
copy the kit's `hooks` and `permissions.deny` into the root `.claude/settings.json` (create or merge, never drop
existing rules). Skills in `crm/.claude/skills/` are found when working in that folder; if one is not offered, read
its `SKILL.md` and follow it.
**Local, project not where Claude Code started:** ask the owner to restart Claude Code in the project folder before
step 3, so its settings (Airtable write tools blocked) and skills load.

Write the choice to `kb/decisions.md` (`<date> — project lives in <repo>/<folder> — <why> — setup step 2`).
