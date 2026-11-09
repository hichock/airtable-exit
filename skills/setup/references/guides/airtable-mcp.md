# Optional: connect Airtable's MCP (for automations and interface pages)

**What it is for:** Airtable's MCP server lets Claude read your automations, interface pages and connected
accounts, which the normal API does not show. Claude tries this with your read-only token first, through Airtable's
command-line tool. You only need this guide if that does not work, or if you prefer signing in with a browser
instead of a token.
**Safety:** the MCP can also change things. This project blocks its create, update and delete tools in
`.claude/settings.json`, so Claude can only read.

## Option A: the official plugin (browser sign-in, no token)
1. In Claude Code, type: `/plugin install airtable@claude-plugins-official`
   (or in a terminal: `claude plugin install airtable@claude-plugins-official`).
2. Type `/plugin`, open the **Installed** tab, select **Airtable MCP**, choose **Authenticate**.
3. A browser window opens. Sign in to Airtable and pick the bases Claude may see. Click to allow.
4. Back in Claude Code, say "done". Claude lists your bases to check.
Revoke later at https://airtable.com/?integrations=thirdParty.

## Option B: the MCP with your token
In a terminal, in the project folder, with your token in `.env.local`:
```bash
set -a; . ./.env.local; set +a
claude mcp add --transport http airtable https://mcp.airtable.com/mcp --header "Authorization: Bearer ${AIRTABLE_PAT}"
```
Restart Claude Code, type `/mcp`, and check that Airtable says connected. Do not choose Re-authenticate.

## If your company blocks it
On Airtable Enterprise Scale an admin can block the MCP or outside sign-ins. Ask the admin to allow Claude Code's
client, or skip the MCP: Claude then lists automations as "not read" and asks for nothing; the plan shows its
best guess instead.
**Source:** Airtable MCP docs (Claude Code page, CLI page, tools reference), read 2026-11-09.
