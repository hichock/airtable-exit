// Invite a person by email with a role. Usage: npm run invite -- <email> <role> [--airtable usrXXXX]
// --airtable links the Airtable user id, so createdBy and person fields map to this profile in the copy.
// Uses the service-role key from .env.local. The person gets a magic-link email from Supabase.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFile, need } from "./migrate/env.ts";

loadEnvFile();
const [email, role] = process.argv.slice(2);
const roles = (JSON.parse(readFileSync("app.schema.json", "utf8")).roles as { key: string }[]).map((r) => r.key);
if (!email || !role || !roles.includes(role)) {
  console.error(`Usage: npm run invite -- <email> <role>. Roles: ${roles.join(", ")}`);
  process.exit(1);
}
const db = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback` });
if (error || !data.user) { console.error(`Could not invite ${email}: ${error?.message}`); process.exit(1); }
const at = process.argv.includes("--airtable") ? process.argv[process.argv.indexOf("--airtable") + 1] : undefined;
const up = await db.from("profiles").upsert({ id: data.user.id, email: email.toLowerCase(), role, ...(at ? { airtable_user_id: at } : {}) });
if (up.error) { console.error(`Invited, but the role was not saved: ${up.error.message}`); process.exit(1); }
console.log(`Invited ${email} as ${role}.`);
