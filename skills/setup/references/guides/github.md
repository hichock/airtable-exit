# GitHub: where your app's code lives

**What it is for:** GitHub keeps the code of your app, private, in your account. Vercel deploys from it, and Claude
Code's cloud sessions and scheduled checks work on it. The free plan includes private repos.

## 1. Account
Open https://github.com/signup and follow the steps (email, password, username). Free plan.

## 2. Let Claude use it
- **Cloud session (claude.ai/code):** GitHub is connected when you start a session with a repo selected. If Claude
  says it cannot reach GitHub, connect or reconnect at https://claude.ai/connect-github and allow the Claude GitHub
  App on your repo.
- **Your computer, terminal:** Claude runs `gh auth login`. Answer: **GitHub.com** → **HTTPS** → **Login with a web
  browser**. Copy the one-time code it shows, press Enter, paste the code in the browser, click **Authorize**.
  Claude checks with `gh auth status`.
- **Connector:** if the GitHub connector is on in claude.ai → Settings → Connectors, Claude can use it instead.

## 3. A new private repo (only when Claude asks)
Claude creates it for you on your computer (`gh repo create <name> --private`). To do it by hand, for example for a
cloud session:
1. Open https://github.com/new.
2. **Repository name:** e.g. `acme-crm`. Choose **Private**.
3. Leave "Add a README" unticked (an empty repo is easiest). Click **Create repository**.
4. In a cloud session, attach it: see [claude-cloud-session.md](claude-cloud-session.md) → "Use a new repo".

**Source:** GitHub docs and `gh auth login` prompts, checked 2026-11-09.
