# Vercel: put the app online for free

**What it is for:** Vercel runs the app and gives it a web address. Every change pushed to GitHub goes live
automatically. The **Hobby** plan is free.
**Hobby limits** (vercel.com/docs, read 2026-11-09): scheduled jobs at most once a day (this app's are daily),
functions up to 5 minutes, 100 GB transfer a month. Vercel's fair-use rules describe Hobby as for personal,
non-commercial use; if that matters to your company, Pro is $20 per developer per month (people who only use the
app don't need a Vercel seat).

## 1. Account (2 minutes)
1. Open https://vercel.com/signup, choose **Hobby**, and **Continue with GitHub** (this links your repos).

## 2. Let Claude connect (pick the easiest)
- **Connector (best):** in claude.ai → Settings → Connectors, add **Vercel** and sign in. Claude creates the project,
  sets the settings and deploys.
- **Terminal on your computer:** Claude runs `vercel login`; a browser window opens; click to allow.
- **By hand in the dashboard:** steps 3 to 5. This works from anywhere, also from a phone.

## 3. Import the repo
1. In the dashboard, click **Add New… → Project**.
2. Under **Import Git Repository**, find your repo (e.g. `acme-crm`) and click **Import**. If it is not listed,
   click the link to adjust GitHub app permissions and allow that repo.
3. Framework: Vercel detects **Next.js**. If the project is in a folder (e.g. `crm/`), click **Edit** next to
   **Root Directory** and pick that folder.

## 4. Environment variables (the settings and keys the app needs)
On the import screen open **Environment Variables**, or later: open the project → **Settings → Environment
Variables**. For each line: type the **Key** (name), paste the **Value**, keep all environments ticked, click **Add**
(or **Save**). Claude tells you which names; usually:

| Key | Value from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (or anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret (or service_role) key. Mark it **Sensitive** if offered |
| `CRON_SECRET` | A random value Claude generates for you (in `.env.local`) |
| `NEXT_PUBLIC_SITE_URL` | Your app address, e.g. `https://acme-crm.vercel.app` (add after the first deploy, then redeploy). Never `localhost`: sign-in and invite emails link to this address |

Tip: Vercel lets you paste several lines of `KEY=value` at once into the Key field.
Do not add `DEMO`, `AIRTABLE_PAT` or `AIRTABLE_BASE_ID` now. Claude adds the Airtable ones only for the
parallel run, and removes them at cutover.

## 5. Deploy
1. Click **Deploy** and wait until it says the deployment is ready. Copy the address it shows.
2. After adding or changing a variable, redeploy: **Deployments** → the latest one → **⋯** → **Redeploy**.
3. Tell Claude the address. It checks `<address>/api/health`.

## Same with the terminal (Claude does this)
```bash
vercel link --yes
printf %s "<value>" | vercel env add NEXT_PUBLIC_SUPABASE_URL production   # and preview; one per variable
vercel env ls                                                              # names only
vercel deploy --prod
```
**Sources:** Vercel docs on the Hobby plan, environment variables and cron jobs, read 2026-11-09.
