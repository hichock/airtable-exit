import { test } from "node:test";
import assert from "node:assert/strict";
import { AirtableClient, RateLimiter, type Deps } from "./client.ts";
import { attachmentPath, diffValues, normalize, sample, transformRecord } from "./transform.ts";
import { deltaFormula, idDiff, importColumns, splitBySize } from "./sync.ts";
import type { TableDef } from "../schema/types.ts";

const deals: TableDef = {
  key: "deals", label: "Deals", primaryField: "name", views: [{ key: "all", label: "All", type: "grid" }],
  airtable: { id: "tblDeals" },
  fields: [
    { key: "name", label: "Name", type: "text", airtable: { id: "fldName" } },
    { key: "value", label: "Value", type: "currency", airtable: { id: "fldValue" } },
    { key: "won", label: "Won", type: "checkbox", airtable: { id: "fldWon" } },
    { key: "stage", label: "Stage", type: "select", options: [{ value: "Won" }], airtable: { id: "fldStage" } },
    { key: "tags", label: "Tags", type: "multiSelect", options: [{ value: "a" }], airtable: { id: "fldTags" } },
    { key: "owner", label: "Owner", type: "user", airtable: { id: "fldOwner" } },
    { key: "company", label: "Company", type: "link", link: { table: "companies", multiple: false }, airtable: { id: "fldCo" } },
    { key: "files", label: "Files", type: "attachment", airtable: { id: "fldFiles" } },
    { key: "weighted", label: "Weighted", type: "formula", computed: { kind: "formula", expr: "{value}", mode: "generated" }, airtable: { id: "fldW" } },
    { key: "close", label: "Close", type: "date", airtable: { id: "fldClose" } },
  ],
};

test("transform: types, empty → null, absent checkbox = false, links and files split out, formulas skipped", () => {
  const out = transformRecord(deals, {
    id: "rec1", createdTime: "2025-03-01T10:00:00.000Z",
    fields: {
      fldName: "  Portal  ", fldValue: 1200, fldStage: "Won", fldTags: ["a"],
      fldOwner: { id: "usrX", email: "Maya@Example.com", name: "Maya" },
      fldCo: ["recCo1"], fldFiles: [{ id: "att1", url: "https://x", filename: "a.pdf", size: 10 }], fldW: 999, fldClose: "2026-01-02",
    },
  }, { people: new Map([["maya@example.com", "uuid-maya"]]) });
  assert.deepEqual(out.values, { name: "Portal", value: 1200, won: false, stage: "Won", tags: ["a"], owner: "uuid-maya", close: "2026-01-02", __created_at: "2025-03-01T10:00:00.000Z" });
  assert.deepEqual(out.links, [{ field: "company", airtableIds: ["recCo1"] }]);
  assert.equal(out.attachments[0]?.items[0]?.filename, "a.pdf");
  assert.deepEqual(out.unmatchedUsers, []);
});

test("transform: unknown people are reported, not invented", () => {
  const out = transformRecord(deals, { id: "r", createdTime: "2025-01-01T00:00:00Z", fields: { fldOwner: { id: "usrZ", email: "gone@example.com" } } }, { people: new Map() });
  assert.equal(out.values.owner, null);
  assert.deepEqual(out.unmatchedUsers, ["gone@example.com"]);
});

test("import columns: single links are left for pass 2, airtable_id and created_at kept", () => {
  const cols = importColumns(deals, { name: "A", value: 1, owner: "u", __created_at: "2025-01-01" }, "rec1");
  assert.deepEqual(cols, { airtable_id: "rec1", created_at: "2025-01-01", name: "A", value: 1, owner_id: "u" });
});

test("parity: normalise and diff", () => {
  assert.equal(normalize(""), normalize(null));
  assert.equal(normalize(["b", "a"]), normalize(["a", "b"]));
  assert.equal(normalize("2026-01-01T10:00:00.000+00:00"), normalize("2026-01-01T10:00:00Z"));
  assert.deepEqual(diffValues({ name: "A", value: 1, __created_at: "x" }, { name: "A", value: 2 }), ["value"]);
  assert.deepEqual(sample([1, 2, 3, 4, 5], 3), sample([1, 2, 3, 4, 5], 3));
  assert.equal(sample([1, 2, 3], 10).length, 3);
});

test("attachment paths start with the table key (RLS reads the first segment)", () => {
  assert.equal(attachmentPath("deals", "rec1", { id: "att1", url: "", filename: "Q3 plan (final).pdf" }), "deals/rec1/att1-Q3_plan_final_.pdf");
});

test("files over the per-file limit are split off; unknown size counts as small", () => {
  const items = [{ id: "a", url: "u", filename: "small.pdf", size: 10 }, { id: "b", url: "u", filename: "big.mov", size: 60_000_000 }, { id: "c", url: "u", filename: "nosize.txt" }];
  const r = splitBySize(items, 50_000_000);
  assert.deepEqual(r.keep.map((a) => a.filename), ["small.pdf", "nosize.txt"]);
  assert.deepEqual(r.tooBig.map((a) => a.filename), ["big.mov"]);
  assert.equal(splitBySize(items, undefined).tooBig.length, 0);
});

test("id diff: missing in Supabase and extra rows deleted in Airtable", () => {
  assert.deepEqual(idDiff(["rec1", "rec2", "rec3"], ["rec2", "rec3", "rec9"]), { missing: ["rec1"], extra: ["rec9"] });
});

test("delta formula strips quotes", () => {
  assert.equal(deltaFormula("2026-11-01T00:00:00Z'"), "IS_AFTER(LAST_MODIFIED_TIME(), '2026-11-01T00:00:00Z')");
});

function fakeDeps(responses: { status: number; body: unknown }[]) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  let t = 0;
  const deps: Deps = {
    now: () => t,
    sleep: async (ms) => { sleeps.push(ms); t += ms; },
    fetch: (async (url: string) => {
      calls.push(String(url));
      const r = responses.shift() ?? { status: 500, body: "no more" };
      return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch,
  };
  return { deps, calls, sleeps };
}

test("rate limiter spaces calls at 5 per second", async () => {
  const { deps, sleeps } = fakeDeps([]);
  const rl = new RateLimiter(5, deps);
  for (let i = 0; i < 4; i++) await rl.wait();
  assert.deepEqual(sleeps, [200, 200, 200]);
});

test("client pages with offset, asks for field ids, waits 30 s on 429", async () => {
  const { deps, calls, sleeps } = fakeDeps([
    { status: 200, body: { records: [{ id: "r1", createdTime: "x", fields: {} }], offset: "o1" } },
    { status: 429, body: "slow down" },
    { status: 200, body: { records: [{ id: "r2", createdTime: "x", fields: {} }] } },
  ]);
  const c = new AirtableClient("tok", deps);
  const ids: string[] = [];
  for await (const page of c.records("appB", "tblT")) ids.push(...page.map((r) => r.id));
  assert.deepEqual(ids, ["r1", "r2"]);
  assert.match(calls[0]!, /returnFieldsByFieldId=true/);
  assert.match(calls[1]!, /offset=o1/);
  assert.ok(sleeps.includes(30_000));
});

test("client errors name the status and path", async () => {
  const { deps } = fakeDeps([{ status: 403, body: "INVALID_PERMISSIONS" }]);
  await assert.rejects(new AirtableClient("t", deps).get("meta/bases"), /Airtable 403 on meta\/bases: INVALID_PERMISSIONS/);
});

import { splitPeople, summarizeRecords } from "./inventory.ts";

test("usage summary: fill rate, months, duplicates, attachment bytes, people", () => {
  const u = summarizeRecords(
    { primaryFieldId: "fldN", fields: [{ id: "fldN", type: "singleLineText" }, { id: "fldF", type: "multipleAttachments" }, { id: "fldB", type: "createdBy" }, { id: "fldE", type: "email" }] },
    [
      { id: "r1", createdTime: "2026-01-05T00:00:00Z", fields: { fldN: "Acme", fldF: [{ size: 1000 }, { size: 60_000_000 }], fldB: { id: "usr1" } }, commentCount: 2 },
      { id: "r2", createdTime: "2026-02-01T00:00:00Z", fields: { fldN: "acme ", fldB: { id: "usr1" } } },
      { id: "r3", createdTime: "2026-02-03T00:00:00Z", fields: { fldN: "Other", fldE: "" } },
    ],
  );
  assert.deepEqual(u.createdByMonth, { "2026-01": 1, "2026-02": 2 });
  assert.equal(u.duplicatePrimary, 2);
  assert.deepEqual(u.attachments, { files: 2, bytes: 60_001_000, largestBytes: 60_000_000, overLimit: 1 });
  assert.equal(u.fields.fldE?.fillRate, 0);
  assert.equal(u.fields.fldN?.fillRate, 1);
  assert.equal(u.fields.fldF?.fillRate, 0.333);
  assert.deepEqual(u.people, { usr1: 2 });
  assert.equal(u.commentRecords, 1);
  assert.equal(u.firstCreated, "2026-01-05T00:00:00Z");
});

test("people: counts by permission level for kb, emails only in the people list", () => {
  const r = splitPeople({ collaborators: { baseCollaborators: { individualCollaborators: [{ userId: "u1", email: "a@example.com", permissionLevel: "create" }, { userId: "u2", email: "b@example.com", permissionLevel: "edit" }] }, workspaceCollaborators: { individualCollaborators: [{ userId: "u3", email: "c@example.com", permissionLevel: "edit" }] } } });
  assert.deepEqual(r.counts, [{ permissionLevel: "create", count: 1, via: "base" }, { permissionLevel: "edit", count: 1, via: "base" }, { permissionLevel: "edit", count: 1, via: "workspace" }]);
  assert.ok(!JSON.stringify(r.counts).includes("@"));
  assert.equal(r.people.length, 3);
});
