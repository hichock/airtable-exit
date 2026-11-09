# Working in a Claude Code cloud session (claude.ai/code)

**What it is:** Claude works on a copy of one GitHub repo on a cloud computer. You chat in the browser or the app;
nothing runs on your computer. The repo is chosen when the session starts, and Claude cannot create a new repo
from inside the session.

## Start a session for this project
1. Open https://claude.ai/code.
2. Pick the repo (an empty private repo is best: [github.md](github.md) → "A new private repo").
3. Type: `Set up airtable-exit from github.com/hichock/airtable-exit` (or `/airtable-exit:setup` if the plugin is
   available). Claude fetches the bundle and follows its setup.

## Use a new repo
If the current repo already has other files and you prefer a clean one:
1. Create an empty private repo on GitHub ([github.md](github.md)).
2. Start a new session on claude.ai/code with that repo selected, or ask Claude to add it to this session (it can
   attach a repo you have given the Claude GitHub App access to).
3. Say "continue setup". Progress is saved in the repo (`kb/setup-state.md`) once the first commit is pushed.

## Add a key (Airtable token, Supabase keys)
Never paste keys into the chat. Use the environment settings:
1. In the session's title bar, open the cloud environment menu and choose **Edit**.
2. Preferred: **Network secrets** (called API credentials in older apps). Add the key for its host, e.g. the
   Airtable token for `api.airtable.com` and `mcp.airtable.com`. Claude Code adds it to requests to that host and
   Claude never sees it. Claude may also show you a secure form for this; that is the same thing.
3. Otherwise, and for the Supabase secret key (the scripts send it in a way a network secret may not cover):
   **Environment variables**, with the exact name Claude tells you (e.g. `SUPABASE_SERVICE_ROLE_KEY`). Note: anyone
   who can edit this environment can read these values.
4. Start a new session (or tell Claude to continue): new sessions pick up the change.
Files like `.env.local` are not kept between cloud sessions (each session starts from the repo), so keys belong in
the environment settings, not in a file.

## Network: when a site is blocked
Cloud sessions can only reach allowed sites. This project needs: `api.airtable.com`, `mcp.airtable.com`,
`api.supabase.com`, `<your-project>.supabase.co`, `api.vercel.com`, and for help requests
`jobsearch-roan-ten.vercel.app`. If Claude says a site is blocked: environment menu → **Edit** → **Network access**
→ add the host under **Allowed domains** (keep "Allow package managers" ticked), or pick a broader access level.
Claude may show an approval card for this instead; approving it does the same.

## Pushing and deploying
Claude pushes to a branch for this session. To make it live, merge it into your main branch (the session shows a
button to create a pull request; merge it on GitHub). Vercel deploys the main branch.

## Connectors
claude.ai → Settings → Connectors: add **Supabase** and **Vercel** to let Claude create the database and deploy
without any keys or terminals. Connectors you add there are available in cloud sessions.

**Sources:** Claude Code cloud environment docs (code.claude.com/docs/en/cloud-environments), read 2026-11-09.
