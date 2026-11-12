// Where sign-in and invite emails land. Three kinds of link reach this route:
// 1. ?code=…        magic link from the login page (PKCE): exchange the code for a session cookie.
// 2. ?token_hash=…  links from customised email templates: verify the one-time token.
// 3. #access_token= invites sent with the admin API (Supabase's default invite email). The browser keeps the part
//                   after # to itself, so GET answers a tiny page that POSTs the tokens back here to set the cookie.
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getMode } from "@/lib/env";
import { userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const toLogin = (origin: string, message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, origin));

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = getMode();
  if (mode.kind !== "supabase") return NextResponse.redirect(new URL("/", url.origin));
  const q = url.searchParams;
  const failed = q.get("error_description") ?? q.get("error");
  if (failed) return toLogin(url.origin, failed);
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  if (code || tokenHash) {
    const client = await userClient(mode.url, mode.anonKey);
    const { error } = code
      ? await client.auth.exchangeCodeForSession(code)
      : await client.auth.verifyOtp({ token_hash: tokenHash!, type: (q.get("type") ?? "email") as EmailOtpType });
    if (error) return toLogin(url.origin, `${error.message}. Ask for a new link.`);
    return NextResponse.redirect(new URL("/", url.origin));
  }
  return new NextResponse(FRAGMENT_PAGE, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

// Receives the tokens from FRAGMENT_PAGE. Same-origin only; Supabase checks the token before a cookie is set.
export async function POST(req: NextRequest) {
  const mode = getMode();
  if (mode.kind !== "supabase") return NextResponse.json({ error: "Demo mode has no sign-in." }, { status: 400 });
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try { originHost = new URL(req.headers.get("origin") ?? "").host; } catch { /* no or bad Origin header */ }
  const fetchSite = req.headers.get("sec-fetch-site");
  if (!host || originHost !== host || (fetchSite && fetchSite !== "same-origin")) return NextResponse.json({ error: "Wrong origin." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown } | null;
  const access = typeof body?.access_token === "string" ? body.access_token : "";
  const refresh = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  if (!access || !refresh || access.length > 8192 || refresh.length > 1024) return NextResponse.json({ error: "The link is incomplete. Ask for a new one." }, { status: 400 });
  const client = await userClient(mode.url, mode.anonKey);
  const { error } = await client.auth.setSession({ access_token: access, refresh_token: refresh });
  if (error) return NextResponse.json({ error: `${error.message}. Ask for a new link.` }, { status: 401 });
  return NextResponse.json({ ok: true });
}

const FRAGMENT_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><title>Signing in</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;margin:0;padding:48px 16px;text-align:center">
<p id="msg">Signing you in…</p><noscript>Turn on JavaScript to finish signing in.</noscript>
<script>
(function () {
  var h = new URLSearchParams(location.hash.slice(1));
  function fail(m) { location.replace("/login?error=" + encodeURIComponent(m)); }
  if (h.get("error_description")) return fail(h.get("error_description"));
  var a = h.get("access_token"), r = h.get("refresh_token");
  if (!a || !r) return location.replace("/");
  history.replaceState(null, "", location.pathname);
  fetch(location.pathname, { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: a, refresh_token: r }) })
    .then(function (res) { return res.ok ? location.replace("/") : res.json().then(function (j) { fail(j.error || "Sign-in failed."); }); })
    .catch(function () { fail("Sign-in failed. Ask for a new link."); });
})();
</script></body></html>`;
