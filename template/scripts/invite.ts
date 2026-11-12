// Invite a person by email with a role. Usage: npm run invite -- <email> <role> [--airtable usrXXXX] [--local]
// --airtable links the Airtable user id, so createdBy and person fields map to this profile in the copy.
// Uses the service-role key from .env.local. The person gets an invite email from Supabase whose link opens
// NEXT_PUBLIC_SITE_URL/auth/callback. Before the first invite run `npm run auth:check`: the live URL must be set here
// and in Supabase, and Supabase's built-in email only reaches members of your Supabase organization (custom SMTP
// for everyone else: skills/setup/references/guides/supabase.md → "Email").
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { helpAndExit, loadEnvFile, need } from "./migrate/env.ts";
import { callbackUrl, emailErrorHint, siteUrl, siteUrlProblem } from "../lib/auth/site.ts";

const USAGE = "Usage: npm run invite -- <email> <role> [--airtable usrXXXX] [--local]\n--local allows a localhost NEXT_PUBLIC_SITE_URL (only for a local Supabase).";
helpAndExit(USAGE);
loadEnvFile();
const args = process.argv.slice(2);
const [email, role] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--airtable");
const roles = (JSON.parse(readFileSync("app.schema.json", "utf8")).roles as { key: string }[]).map((r) => r.key);
if (!email || !role || !roles.includes(role)) {
  console.error(`${USAGE}\nRoles: ${roles.join(", ")}`);
  process.exit(1);
}
const supabaseUrl = need("NEXT_PUBLIC_SUPABASE_URL");
const site = siteUrl(process.env);
const problem = siteUrlProblem(site, supabaseUrl);
if (problem && !args.includes("--local")) { console.error(`Not sent. ${problem}`); process.exit(1); }
const db = createClient(supabaseUrl, need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: callbackUrl(site ?? "http://localhost:3000") });
if (error || !data.user) { console.error(`Could not invite ${email}: ${error?.message}.${emailErrorHint(error?.message ?? "")}`); process.exit(1); }
const at = args.includes("--airtable") ? args[args.indexOf("--airtable") + 1] : undefined;
const up = await db.from("profiles").upsert({ id: data.user.id, email: email.toLowerCase(), role, ...(at ? { airtable_user_id: at } : {}) });
if (up.error) { console.error(`Invited, but the role was not saved: ${up.error.message}`); process.exit(1); }
console.log(`Invited ${email} as ${role}. The link opens ${callbackUrl(site ?? "")}.`);
