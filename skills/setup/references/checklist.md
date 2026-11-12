# Setup checklist: commands, checks, fixes

Facts are labelled: **sourced** (official docs, read 2026-11-08 or 2026-11-09), **assumed** (our judgement, test it).
Click-by-click steps for the owner are in [guides/](guides/). Detection rules: [detect.md](detect.md).

## setup-state
The checklist itself is `kit/kb/setup-state.md` (copied to `kb/setup-state.md` in step 2). Tick `[x]` only after
the check passes and add a dated line under Notes.

## §1 Tools (install only what a later step needs and no connector covers)
| Tool | Check | Install | Needed for |
|---|---|---|---|
| Node 20.11+ | `node -v` | nodejs.org installer, or `brew install node` | Always |
| git | `git --version` | `brew install git` / OS package | Always |
| GitHub CLI | `gh --version` | `brew install gh` (cli.github.com for others) | Local repo creation, unless the GitHub connector is there |
| Supabase CLI | `supabase --version` | `brew install supabase/tap/supabase`, or `npx supabase` everywhere | Step 7, unless the Supabase connector is there |
| Vercel CLI | `vercel --version` | `npm i -g vercel` | Step 8, unless the Vercel connector or the dashboard path is used |
| Airtable MCP CLI | `airtable-mcp --version` | `npm i -g @airtable/mcp-cli` | MCP reads when no Airtable tools are in the session |

## §2 Logins (only when needed)
- `gh auth login` → GitHub.com, HTTPS, browser. Check `gh auth status`.
- `supabase login` → browser token. Check `supabase projects list` returns a table (may be empty).
- `vercel login` → browser. Check `vercel whoami`.
A connector in the session replaces the login for that service.

## §3 Airtable access
**Ways in** (sourced, Airtable MCP docs):
- Read-only token (PAT) in `.env.local` as `AIRTABLE_PAT`: REST inventory, data copy, nightly sync. Also drives the
  MCP through the CLI: `AIRTABLE_TOKEN="$AIRTABLE_PAT" airtable-mcp tools`, `airtable-mcp <tool> --json`
  (arguments as JSON on stdin with `--input -`). Guide: [airtable-token.md](guides/airtable-token.md).
- Optional: the official plugin `claude plugin install airtable@claude-plugins-official`, then `/plugin` →
  Installed → Airtable MCP → Authenticate. Or the hosted MCP with the token:
  `claude mcp add --transport http airtable https://mcp.airtable.com/mcp --header "Authorization: Bearer ${AIRTABLE_PAT}"`
  (restart Claude Code, check `/mcp`). Guide: [airtable-mcp.md](guides/airtable-mcp.md).
- MCP accepting a read-only token for automation reads: **assumed**, test it on the first run.

**Read-only scopes** (sourced, Airtable scopes page):
`schema.bases:read`, `data.records:read`, `data.recordComments:read`, `workspacesAndBases:read`, `user.email:read`.
Optional `webhook:manage` only to list existing webhooks; it is also a write scope, so leave it out unless needed.
Never `data.records:write` or `schema.bases:write`. Access: only the bases being moved.
Check: `curl -s -H "Authorization: Bearer $AIRTABLE_PAT" https://api.airtable.com/v0/meta/whoami` returns an id.

**Write tools are denied** in the kit's `.claude/settings.json` (patterns `mcp__*irtable*__create_*`, `update_*`,
`delete_*`, plus `submit_form`, `revert_action`, `test_automation_webhook_trigger`). Tool names: Airtable MCP tools
reference, read 2026-11-09. The CLI is not covered by these rules: the skills only call read tools with it.

**Blockers** (sourced): on Enterprise Scale an admin can block MCP or all third-party OAuth. Claude Code's client
(`https://claude.ai/oauth/claude-code-client-metadata`) can be allowlisted. The REST API with a PAT still works.

**Budget** (sourced): MCP calls count against API limits. Free: 1,000 calls/workspace/month. Team: 100,000, then
throttled to 2 req/s. Business and Enterprise Scale: no monthly cap. 5 req/s per base.

## §7 Supabase (Free by default)
Connector path (preferred when its tools are in the session): `list_organizations` → `create_project` (free plan,
region near the team; the tool may ask to confirm cost: it is $0 on Free) → wait until it is active →
`apply_migration` once per file in `supabase/migrations/` in order, named like the file → `get_project_url` and
`get_publishable_keys` → `.env.local`. The secret key is not returned by the connector: the owner copies it
([guides/supabase.md](guides/supabase.md)).

CLI path:
```bash
supabase orgs list                                   # pick the org id
supabase projects create <name> --org-id <org> --region <region> --db-password "$(openssl rand -base64 24)"
supabase link --project-ref <ref>                    # asks for the db password once
bash scripts/test-migrations-local.sh                # local Postgres + RLS checks, must pass first
supabase db push                                     # applies supabase/migrations in order
supabase projects api-keys --project-ref <ref>       # keys → .env.local, never echo them
```
Put in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(publishable key, or the legacy anon key), `SUPABASE_SERVICE_ROLE_KEY` (secret key, or the legacy service_role key).
Using the new publishable and secret keys in place of the legacy ones: **assumed** to work with supabase-js (Supabase
shows them in the same places in its examples); fall back to the legacy keys if sign-in or the copy fails.
Store the db password in the owner's password manager, not in the repo.
Free plan (sourced, supabase.com/pricing): 500 MB database, 1 GB files, 50 MB per file, 2 active projects, pauses
after 1 week with no activity. Plenty for most small CRMs. Files over 50 MB are skipped by the copy and listed.
Auth (after §8 gives the live URL): Site URL = the Vercel URL; `<url>/auth/callback` in Redirect URLs.
`npm run auth:check -- --fix` sets both through the Management API when a Supabase access token is available
(`SUPABASE_ACCESS_TOKEN`, or the one `supabase login` saved); else Dashboard → Authentication → URL Configuration.
Supabase falls back to the Site URL (default `http://localhost:3000`) when the redirect URL is not allowed (sourced,
Supabase docs "Redirect URLs", read 2026-11-12). Email sign-ups can stay off: the app only lets invited people in.
**Email sending** (sourced, Supabase docs "Custom SMTP", read 2026-11-12): without custom SMTP, Supabase Auth only
delivers to members of the project's organization ("Email address not authorized" for everyone else) and at most
2 messages an hour. Custom SMTP is required before inviting anyone else. Default: Resend (free plan 3,000 emails a
month, 100 a day, sourced resend.com/pricing 2026-11-12): verify a domain, create an API key, then Supabase →
Authentication → Emails → SMTP Settings: host `smtp.resend.com`, port `465`, user `resend`, password = the API key,
sender `no-reply@<verified domain>` (sourced, resend.com/docs/send-with-supabase-smtp, read 2026-11-12). Supabase
then allows 30 emails an hour; raise it in Authentication → Rate Limits if a big team is invited at once.
Owner's steps: [guides/supabase.md](guides/supabase.md) → "Email". `npm run auth:check` shows `ok` for SMTP once on.

## §8 Vercel (Hobby by default)
Connector path: `create_project` (or import the GitHub repo) → `create_project_env` per variable for production and
preview → `create_deployment` or a push to the production branch → read the URL.
CLI path:
```bash
vercel link --yes
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CRON_SECRET; do
  for env in production preview; do grep "^$k=" .env.local | cut -d= -f2- | vercel env add "$k" "$env"; done
done
vercel deploy --prod                                  # prints the production URL
# then the live URL (never the localhost value from .env.example), in Vercel and in .env.local:
URL=https://<project>.vercel.app
printf %s "$URL" | vercel env add NEXT_PUBLIC_SITE_URL production
sed -i.bak "s#^NEXT_PUBLIC_SITE_URL=.*#NEXT_PUBLIC_SITE_URL=$URL#" .env.local && rm .env.local.bak
vercel deploy --prod                                  # NEXT_PUBLIC_ values are read at build time
npm run auth:check -- --fix                           # Site URL + redirect URL in Supabase (§7 "Auth")
```
Dashboard path (no tools): [guides/vercel.md](guides/vercel.md).
`CRON_SECRET`: generate with `openssl rand -hex 24` into `.env.local` first. `AIRTABLE_PAT`, `AIRTABLE_BASE_ID` and
`SYNC_ENABLED=1` are added later by `/sync-and-cutover`, only for the parallel run. A changed env var needs a redeploy.
Project in a subfolder (`crm/`): set Root Directory to `crm` in the project settings.
Hobby (sourced, vercel.com/docs/plans/hobby and cron docs): free; crons at most once a day, timing within the hour
(this app's two crons are daily); functions up to 300 s. Vercel's fair-use guidelines describe Hobby as
non-commercial, personal use: the plan says so in one line and the owner decides. Pro: $20 per developer seat.

## §10 Schedules
- Claude Code scheduled task (needs a paid Claude plan, minimum hourly, runs on the repo with its skills): weekly,
  prompt `/health`. Ask the owner to create it with `/schedule` or in claude.ai/code, pointing at the new repo.
- GitHub Actions alternative: `.github/workflows/health.yml` (needs repo secret `CLAUDE_CODE_OAUTH_TOKEN` from
  `claude setup-token`). GitHub pauses schedules on public repos after 60 days without activity (sourced).
- Vercel cron (`vercel.json`): `/api/cron/sync` nightly and `/api/cron/stale-deals` on weekdays. Both need
  `CRON_SECRET`; sync also needs `SYNC_ENABLED=1`.
