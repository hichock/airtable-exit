# Setup checklist: commands, checks, fixes

Facts are labelled: **sourced** (official docs, read 2026-11-08), **assumed** (our judgement, test it).

## setup-state
The checklist itself is `kit/kb/setup-state.md` (copied to `kb/setup-state.md` in step 3). Tick `[x]` only after
the check passes and add a dated line under Notes.

## §1 Tools
| Tool | Check | Install |
|---|---|---|
| Node 20.11+ | `node -v` | nodejs.org installer, or `brew install node` |
| git | `git --version` | `brew install git` / OS package |
| GitHub CLI | `gh --version` | `brew install gh` (cli.github.com for others) |
| Supabase CLI | `supabase --version` | `brew install supabase/tap/supabase`, or use `npx supabase` everywhere |
| Vercel CLI | `vercel --version` | `npm i -g vercel` |

## §2 Logins
- `gh auth login` → GitHub.com, HTTPS, browser. Check `gh auth status`.
- `supabase login` → browser token. Check `supabase projects list` returns a table (may be empty).
- `vercel login` → browser. Check `vercel whoami`.

## §4 Airtable access
**Ways in** (sourced, Airtable MCP docs):
- Official plugin: `/plugin install airtable@claude-plugins-official`, then OAuth in the browser; the owner picks
  bases. Revoke later at `airtable.com/?integrations=thirdParty`. Airtable recommends it for Claude Code.
- Hosted MCP with a token: `claude mcp add --transport http airtable https://mcp.airtable.com/mcp --header "Authorization: Bearer ${AIRTABLE_PAT}"`.
- MCP from scripts: `npm i -g @airtable/mcp-cli`, then `AIRTABLE_TOKEN=… airtable-mcp <tool> --json`.
- OAuth gives the agent no token for a fast bulk script, so the copy needs a personal access token (assumed: the
  plugin's OAuth token is not exposed to scripts).

**Token (PAT), read-only scopes** (sourced, Airtable scopes page):
`schema.bases:read`, `data.records:read`, `data.recordComments:read`, `workspacesAndBases:read`, `user.email:read`.
Optional `webhook:manage` only to list existing webhooks; it is also a write scope, so leave it out unless needed.
Never ask for `data.records:write` or `schema.bases:write`.
Create it at `https://airtable.com/create/tokens` (Airtable's Claude Code page also offers a link with scopes
pre-selected: remove any write scopes it adds). Access: only the bases being moved.
Check: `curl -s -H "Authorization: Bearer $AIRTABLE_PAT" https://api.airtable.com/v0/meta/whoami` returns an id.

**Blockers** (sourced): on Enterprise Scale an admin can block MCP or all third-party OAuth. Claude Code's client
(`https://claude.ai/oauth/claude-code-client-metadata`) can be allowlisted. The REST API with a PAT still works.

**Budget** (sourced): MCP calls count against API limits. Free: 1,000 calls/workspace/month. Team: 100,000, then
throttled to 2 req/s. Business and Enterprise Scale: no monthly cap. 5 req/s per base.

## §9 Supabase
```bash
supabase orgs list                                   # pick the org id
supabase projects create <name> --org-id <org> --region <region> --db-password "$(openssl rand -base64 24)"
supabase link --project-ref <ref>                    # asks for the db password once
bash scripts/test-migrations-local.sh                # local Postgres + RLS checks, must pass first
supabase db push                                     # applies supabase/migrations in order
supabase projects api-keys --project-ref <ref>       # anon + service_role → .env.local, never echo them
```
Put in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`. Store the db password in the owner's password manager, not in the repo.
Plan (sourced, supabase.com/pricing): Free pauses after a week idle and caps uploads at 50 MB per file. A business
CRM needs Pro ($25/month per project).
Auth: Dashboard → Authentication → URL configuration: Site URL = the Vercel URL; add `<url>/auth/callback` to
redirect URLs. Email sign-ups can stay off: the app only lets invited people in.

## §10 Vercel
```bash
vercel link --yes
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SITE_URL CRON_SECRET; do
  for env in production preview; do grep "^$k=" .env.local | cut -d= -f2- | vercel env add "$k" "$env"; done
done
vercel deploy --prod
```
`CRON_SECRET`: generate with `openssl rand -hex 24` into `.env.local` first. `AIRTABLE_PAT`, `AIRTABLE_BASE_ID` and
`SYNC_ENABLED=1` are added later by `/sync-and-cutover`, only for the parallel run.
Plan (sourced, vercel.com/pricing): Hobby is for personal, non-commercial use. A company app needs Pro
($20 per developer seat per month; viewers are free).

## §12 Schedules
- Claude Code scheduled task (needs a paid Claude plan, minimum hourly, runs on the repo with its skills): weekly,
  prompt `/health`. Ask the owner to create it with `/schedule` or in claude.ai/code, pointing at the new repo.
- GitHub Actions alternative: `.github/workflows/health.yml` (needs repo secret `CLAUDE_CODE_OAUTH_TOKEN` from
  `claude setup-token`). GitHub pauses schedules on public repos after 60 days without activity (sourced).
- Vercel cron (`vercel.json`): `/api/cron/sync` nightly and `/api/cron/stale-deals` on weekdays. Both need
  `CRON_SECRET`; sync also needs `SYNC_ENABLED=1`.
