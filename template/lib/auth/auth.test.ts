import { test } from "node:test";
import assert from "node:assert/strict";
import { callbackUrl, checkAuthConfig, emailErrorHint, redirectPatternMatches, siteUrl, siteUrlProblem, withCallback } from "./site.ts";

const LIVE = "https://acme-crm.vercel.app";
const DB = "https://abcd1234.supabase.co";

test("siteUrl: env wins, trailing slash dropped, localhost env loses to a real request origin", () => {
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: `${LIVE}/` }), LIVE);
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: LIVE }, "https://other.example.com"), LIVE);
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, LIVE), LIVE);
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, "http://localhost:3000"), "http://localhost:3000");
  assert.equal(siteUrl({}, LIVE), LIVE);
  assert.equal(siteUrl({}), undefined);
  assert.equal(callbackUrl(`${LIVE}/`), `${LIVE}/auth/callback`);
});

test("siteUrlProblem: refuses missing, localhost (with a hosted database) and plain http", () => {
  assert.match(siteUrlProblem(undefined, DB)!, /not set/);
  assert.match(siteUrlProblem("http://localhost:3000", DB)!, /own computer/);
  assert.match(siteUrlProblem("http://127.0.0.1:3000", DB)!, /own computer/);
  assert.match(siteUrlProblem("http://crm.example.com", DB)!, /https/);
  assert.match(siteUrlProblem("not a url", DB)!, /not a URL/);
  assert.equal(siteUrlProblem(LIVE, DB), null);
  assert.equal(siteUrlProblem("http://localhost:3000", "http://127.0.0.1:54321"), null);
});

test("redirectPatternMatches: Supabase wildcard rules", () => {
  assert.ok(redirectPatternMatches(`${LIVE}/auth/callback`, `${LIVE}/auth/callback`));
  assert.ok(redirectPatternMatches(`${LIVE}/**`, `${LIVE}/auth/callback`));
  assert.ok(!redirectPatternMatches(`${LIVE}/*`, `${LIVE}/auth/callback`));
  assert.ok(redirectPatternMatches("https://*-acme.vercel.app/**", "https://crm-git-main-acme.vercel.app/auth/callback"));
  assert.ok(!redirectPatternMatches("http://localhost:3000/**", `${LIVE}/auth/callback`));
});

test("checkAuthConfig: flags wrong site URL, missing redirect and default email", () => {
  const bad = checkAuthConfig(LIVE, { site_url: "http://localhost:3000", uri_allow_list: "http://localhost:3000/**", smtp_host: null });
  assert.deepEqual(bad.map((c) => [c.item, c.ok]), [["site-url", false], ["redirect-url", false], ["smtp", false]]);
  const good = checkAuthConfig(LIVE, { site_url: `${LIVE}/`, uri_allow_list: `http://localhost:3000/**, ${LIVE}/auth/callback`, smtp_host: "smtp.resend.com" });
  assert.ok(good.every((c) => c.ok), JSON.stringify(good));
});

test("withCallback: adds the callback once and keeps existing entries", () => {
  assert.equal(withCallback("http://localhost:3000/**", LIVE), `http://localhost:3000/**,${LIVE}/auth/callback`);
  assert.equal(withCallback(`${LIVE}/**`, LIVE), `${LIVE}/**`);
  assert.equal(withCallback("", LIVE), `${LIVE}/auth/callback`);
});

test("emailErrorHint: explains the default-email errors", () => {
  assert.match(emailErrorHint("Email address not authorized"), /custom SMTP/);
  assert.match(emailErrorHint("email rate limit exceeded"), /2 an hour/);
  assert.equal(emailErrorHint("Invalid email"), "");
});
