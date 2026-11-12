// Where sign-in and invite emails send people back to, and the Supabase Auth settings that make those links work.
// Pure functions (tested in auth.test.ts). Used by app/actions.ts, scripts/invite.ts and scripts/auth-check.ts.

type Env = Record<string, string | undefined>;

const clean = (u: string | undefined | null): string | undefined => {
  const v = (u ?? "").trim().replace(/\/+$/, "");
  return v || undefined;
};

export const isLocalUrl = (u: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(u);

/**
 * The app's public URL, without a trailing slash. NEXT_PUBLIC_SITE_URL wins, except when it still says localhost
 * while the request comes from a real host (a deploy where the variable was never updated): then the request's origin.
 */
export function siteUrl(env: Env, requestOrigin?: string | null): string | undefined {
  const fromEnv = clean(env.NEXT_PUBLIC_SITE_URL);
  const fromReq = clean(requestOrigin);
  if (fromEnv && !(isLocalUrl(fromEnv) && fromReq && !isLocalUrl(fromReq))) return fromEnv;
  return fromReq ?? fromEnv;
}

/** The redirect target for magic links and invites. Must be in Supabase → Authentication → URL Configuration. */
export const callbackUrl = (site: string): string => `${clean(site)}/auth/callback`;

/** Why an email link built on this site URL would not work for someone on another computer, or null if it would. */
export function siteUrlProblem(site: string | undefined, supabaseUrl: string | undefined): string | null {
  if (!site) return "NEXT_PUBLIC_SITE_URL is not set. Set it to the live app URL (e.g. https://acme-crm.vercel.app) in .env.local and in Vercel.";
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    return `NEXT_PUBLIC_SITE_URL is not a URL: ${site}`;
  }
  const localDb = supabaseUrl ? isLocalUrl(supabaseUrl) : false;
  if (isLocalUrl(site)) {
    return localDb ? null : `NEXT_PUBLIC_SITE_URL is ${url.origin}: the email link would open the recipient's own computer. Set it to the live app URL (e.g. https://acme-crm.vercel.app) in .env.local and in Vercel.`;
  }
  if (url.protocol !== "https:") return `NEXT_PUBLIC_SITE_URL must start with https:// (it is ${url.origin}).`;
  return null;
}

/** Supabase redirect-URL wildcards: `**` any characters, `*` and `?` stop at the separators `.` and `/`. */
export function redirectPatternMatches(pattern: string, url: string): boolean {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*" && pattern[i + 1] === "*") { re += ".*"; i++; }
    else if (c === "*") re += "[^./]*";
    else if (c === "?") re += "[^./]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`).test(url);
}

/** The fields this app needs from Supabase's Management API (GET /v1/projects/{ref}/config/auth). */
export interface AuthConfig {
  site_url?: string | null;
  uri_allow_list?: string | null;
  smtp_host?: string | null;
}

export interface AuthCheck {
  item: "site-url" | "redirect-url" | "smtp";
  ok: boolean;
  detail: string;
}

export function checkAuthConfig(site: string, cfg: AuthConfig): AuthCheck[] {
  const target = callbackUrl(site);
  const allow = (cfg.uri_allow_list ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const siteOk = clean(cfg.site_url) === clean(site);
  const redirectOk = allow.some((p) => redirectPatternMatches(p, target));
  const smtpOk = Boolean((cfg.smtp_host ?? "").trim());
  return [
    { item: "site-url", ok: siteOk, detail: siteOk ? `Site URL is ${clean(site)}` : `Site URL is ${cfg.site_url || "(empty)"}, should be ${clean(site)}` },
    { item: "redirect-url", ok: redirectOk, detail: redirectOk ? `${target} is an allowed redirect URL` : `${target} is not in the redirect URLs (${allow.length ? allow.join(", ") : "list is empty"})` },
    { item: "smtp", ok: smtpOk, detail: smtpOk ? `Custom SMTP is on (${cfg.smtp_host})` : "Custom SMTP is off: Supabase's own email only reaches members of your Supabase organization, at most 2 an hour" },
  ];
}

/** The allow list with the callback added (never removes an entry). */
export function withCallback(uriAllowList: string | null | undefined, site: string): string {
  const allow = (uriAllowList ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const target = callbackUrl(site);
  if (!allow.some((p) => redirectPatternMatches(p, target))) allow.push(target);
  return allow.join(",");
}

/** A plain next step for the email errors Supabase returns while custom SMTP is off. */
export function emailErrorHint(message: string): string {
  if (/not authori[sz]ed/i.test(message)) return " Supabase's built-in email only reaches members of your Supabase organization. An admin sets up custom SMTP (for example Resend) in Supabase → Authentication → Emails → SMTP Settings.";
  if (/rate limit/i.test(message)) return " Too many emails this hour. Supabase's built-in email sends 2 an hour; with custom SMTP the limit is set in Authentication → Rate Limits.";
  return "";
}
