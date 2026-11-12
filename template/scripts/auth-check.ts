// Checks what sign-in and invite emails need before anyone is invited. Usage: npm run auth:check -- [--fix]
//   1. NEXT_PUBLIC_SITE_URL in .env.local is the live https URL (not localhost).
//   2. Supabase → Authentication → URL Configuration → Site URL is that URL.
//   3. <that URL>/auth/callback is in the Redirect URLs.
//   4. Custom SMTP is on (Supabase's built-in email only reaches members of your Supabase organization, 2 an hour).
// 2–4 are read with Supabase's Management API and a personal access token (SUPABASE_ACCESS_TOKEN, or the token
// `supabase login` saved in ~/.supabase/access-token). Without one they are printed as "check by hand".
// --fix sets 2 and 3 (adds to the redirect list, never removes). SMTP needs your email provider's key, so it is set
// in the dashboard: skills/setup/references/guides/supabase.md → "Email".
// Exit code: 0 all good, 1 something is wrong, 2 nothing wrong found but some items could not be checked.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { helpAndExit, loadEnvFile } from "./migrate/env.ts";
import { checkAuthConfig, siteUrl, siteUrlProblem, withCallback, type AuthConfig } from "../lib/auth/site.ts";

helpAndExit("Usage: npm run auth:check -- [--fix]\nChecks NEXT_PUBLIC_SITE_URL, the Supabase Site URL, the redirect URL and custom SMTP. --fix sets the two URLs.");
loadEnvFile();
const fix = process.argv.includes("--fix");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const site = siteUrl(process.env);
const ref = process.env.SUPABASE_PROJECT_REF || /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(supabaseUrl ?? "")?.[1];
const page = (slug: string, label: string) => (ref ? `https://supabase.com/dashboard/project/${ref}/auth/${slug}` : `Supabase dashboard → your project → Authentication → ${label}`);
let bad = 0;
let unchecked = 0;
const line = (state: "ok" | "FIX" | "check by hand", text: string) => {
  if (state === "FIX") bad++;
  if (state === "check by hand") unchecked++;
  console.log(`${state.padEnd(13)} ${text}`);
};

const problem = siteUrlProblem(site, supabaseUrl);
line(problem ? "FIX" : "ok", problem ?? `NEXT_PUBLIC_SITE_URL is ${site}`);

const tokenFile = join(homedir(), ".supabase", "access-token");
const token = process.env.SUPABASE_ACCESS_TOKEN || (existsSync(tokenFile) ? readFileSync(tokenFile, "utf8").trim() : "");
const manual = () => {
  line("check by hand", `Site URL = ${site ?? "<live URL>"} (${page("url-configuration", "URL Configuration")})`);
  line("check by hand", `Redirect URLs include ${site ?? "<live URL>"}/auth/callback (same page)`);
  line("check by hand", `Custom SMTP is on (${page("smtp", "Emails → SMTP Settings")}); needed for anyone outside your Supabase organization`);
};

if (!ref) {
  line("FIX", "NEXT_PUBLIC_SUPABASE_URL is not a https://<ref>.supabase.co URL; set it (or SUPABASE_PROJECT_REF) first");
  manual();
} else if (!token) {
  console.log("No Supabase access token (SUPABASE_ACCESS_TOKEN or `supabase login`), so these need a look in the dashboard:");
  manual();
} else if (site && !problem) {
  const api = `${process.env.SUPABASE_API_URL || "https://api.supabase.com"}/v1/projects/${ref}/config/auth`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  try {
    let res = await fetch(api, { headers });
    if (!res.ok) throw new Error(`Management API answered ${res.status}`);
    let cfg = (await res.json()) as AuthConfig;
    let checks = checkAuthConfig(site, cfg);
    if (fix && checks.some((c) => c.item !== "smtp" && !c.ok)) {
      res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify({ site_url: site, uri_allow_list: withCallback(cfg.uri_allow_list, site) }) });
      if (!res.ok) throw new Error(`Management API refused the update (${res.status})`);
      res = await fetch(api, { headers });
      if (!res.ok) throw new Error(`Management API answered ${res.status}`);
      cfg = (await res.json()) as AuthConfig;
      checks = checkAuthConfig(site, cfg);
      console.log("Updated the Site URL and redirect URLs.");
    }
    for (const c of checks) line(c.ok ? "ok" : "FIX", c.ok ? c.detail : `${c.detail}. ${c.item === "smtp" ? `Set it in ${page("smtp", "Emails → SMTP Settings")} (guide: Supabase → Email)` : `Run npm run auth:check -- --fix, or ${page("url-configuration", "URL Configuration")}`}`);
  } catch (e) {
    console.log(`Could not read the auth settings: ${(e as Error).message}.`);
    manual();
  }
} else {
  manual();
}

console.log(bad ? `${bad} item(s) to fix before inviting anyone.` : unchecked ? "Nothing wrong found; confirm the items above by hand." : "Ready: invites and sign-in links will work.");
process.exit(bad ? 1 : unchecked ? 2 : 0);
