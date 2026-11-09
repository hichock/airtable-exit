# Supabase: free database, sign-in and file storage

**What it is for:** Supabase holds your data (a Postgres database), the sign-in for your team and your files.
The **Free** plan costs $0 and is enough for most small CRMs.
**Free limits** (supabase.com/pricing, read 2026-11-09): 500 MB database, 1 GB files in total, **50 MB per file**,
2 active projects, the project pauses after 1 week with no activity (restore it from the dashboard in one click).
Files bigger than 50 MB are not copied; the plan lists them and suggests keeping them where you already store big
files (Google Drive, Dropbox) with a link in the record. Supabase Pro ($25/month) lifts these limits if you ever
need it.

## 1. Account (2 minutes)
1. Open https://supabase.com and click **Start your project**.
2. Sign up. **Continue with GitHub** is the quickest if you have a GitHub account.
3. If asked to create an organization: any name (your company), plan **Free**.

## 2. Let Claude connect (pick the one that is easiest)
- **Connector (best, no terminal):** in claude.ai → Settings → Connectors, add **Supabase** and sign in. Claude then
  creates the project and the tables itself. Works in cloud sessions too.
- **Terminal on your computer:** Claude runs `supabase login`; a browser window opens; click to allow.
- **By hand:** follow step 3, then give Claude the keys as in step 4.

## 3. Create the project by hand (only if Claude asks)
1. In the dashboard, click **New project**.
2. Pick your organization. Name: your project name (e.g. `acme-crm`).
3. Database password: click **Generate a password**, then save it in your password manager. Claude does not need it
   for the app.
4. Region: the one closest to your team. Click **Create new project** and wait about a minute until it is ready.

## 4. Copy the keys (needed once)
1. Open the project. Click **Connect** at the top, or go to **Project Settings → API Keys**.
2. You need three values:
   - Project URL (looks like `https://abcd1234.supabase.co`)
   - **Publishable** key (starts with `sb_publishable_`), or the legacy **anon** key
   - **Secret** key (starts with `sb_secret_`; click to reveal), or the legacy **service_role** key.
     This one is powerful: it bypasses all access rules. Never share it in a chat, email or screenshot.
3. Put them where Claude asked:
   - **On your computer:** in `.env.local`, after `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=` and
     `SUPABASE_SERVICE_ROLE_KEY=`. Save and say "done".
   - **In a cloud session:** add them as described in [claude-cloud-session.md](claude-cloud-session.md) → "Add a key".

## 5. Sign-in links (after the app is on Vercel)
1. Go to **Authentication → URL Configuration**.
2. **Site URL:** your app's address from Vercel (e.g. `https://acme-crm.vercel.app`).
3. **Redirect URLs:** click **Add URL** and add `https://acme-crm.vercel.app/auth/callback`. Save.
Sign-ups by strangers stay off: only people you invite can sign in.

## 6. Only if you upgrade to Pro later
To copy files bigger than 50 MB: **Storage → Settings**, raise the global file size limit, and tell Claude the new
number (it sets `MAX_FILE_MB`).
**Sources:** supabase.com/pricing, Supabase docs on API keys and storage file limits, read 2026-11-09.
