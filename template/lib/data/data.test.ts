import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyQuery, matchFilter, sortRows } from "./query.ts";
import { aggregate, withComputed, linkLabels } from "./computed.ts";
import { patchToDb, rowFromDb } from "./db-map.ts";
import { demoStore, resetDemo } from "../demo/store.ts";
import { getMode } from "../env.ts";
import { canAccess } from "../access.ts";
import type { AppSchema, TableDef } from "../schema/types.ts";
import type { Row } from "./types.ts";

const schema: AppSchema = JSON.parse(readFileSync(new URL("../../app.schema.json", import.meta.url), "utf8"));
const table = (k: string) => schema.tables.find((t) => t.key === k) as TableDef;
const NOW = new Date("2026-11-08T12:00:00Z");

const rows: Row[] = [
  { id: "a", name: "Beta", stage: "Won", value: 300, tags: ["x", "y"], due: "2026-11-01" },
  { id: "b", name: "alpha", stage: "Lost", value: 100, tags: [], due: null },
  { id: "c", name: "Gamma", stage: null, value: 200, tags: ["y"], due: "2026-11-20" },
];

test("filters follow Airtable: 'is not' keeps empty cells, 'is' on arrays means has", () => {
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "stage", op: "neq", value: "Won" })).map((r) => r.id), ["b", "c"]);
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "tags", op: "eq", value: "y" })).map((r) => r.id), ["a", "c"]);
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "tags", op: "empty" })).map((r) => r.id), ["b"]);
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "value", op: "gte", value: 200 })).map((r) => r.id), ["a", "c"]);
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "due", op: "lt", value: "$today" }, NOW)).map((r) => r.id), ["a"]);
  assert.deepEqual(rows.filter((r) => matchFilter(r, { field: "name", op: "contains", value: "AL" })).map((r) => r.id), ["b"]);
});

test("sort puts empty cells last in both directions and ignores case", () => {
  assert.deepEqual(sortRows(rows, [{ field: "due", dir: "desc" }]).map((r) => r.id), ["c", "a", "b"]);
  assert.deepEqual(sortRows(rows, [{ field: "due", dir: "asc" }]).map((r) => r.id), ["a", "c", "b"]);
  assert.deepEqual(sortRows(rows, [{ field: "name", dir: "asc" }]).map((r) => r.id), ["b", "a", "c"]);
});

test("paging reports the full total, not the page size", () => {
  const many = Array.from({ length: 2345 }, (_, i) => ({ id: `r${String(i).padStart(4, "0")}`, name: `Row ${i}` }));
  const t = { ...table("companies") };
  const p = applyQuery(many, t, { filters: [], sorts: [], page: 24, pageSize: 100 });
  assert.equal(p.total, 2345);
  assert.equal(p.rows.length, 45);
  assert.equal(p.rows[0]?.id, "r2300");
});

test("aggregate", () => {
  assert.equal(aggregate("sum", [1, 2, "3"]), 6);
  assert.equal(aggregate("count", [1, null]), 2);
  assert.equal(aggregate("avg", []), null);
  assert.equal(aggregate("max", [4, 9, 2]), 9);
});

test("demo: rollups, lookups and formulas are computed", async () => {
  resetDemo(NOW);
  const companies = table("companies");
  const deals = table("deals");
  const company = (await demoStore.get(companies, "com-1"))!;
  const [c] = await withComputed(schema, companies, [company], demoStore, NOW);
  const mine = await demoStore.all(deals, [{ field: "company", op: "eq", value: "com-1" }]);
  assert.equal(c?.deal_count, mine.length);
  assert.equal(c?.pipeline_value, mine.reduce((a, d) => a + Number(d.value), 0));

  const contact = (await demoStore.get(table("contacts"), "con-1"))!;
  const [ct] = await withComputed(schema, table("contacts"), [contact], demoStore, NOW);
  const its = (await demoStore.get(companies, String(contact.company)))!;
  assert.equal(ct?.company_industry, its.industry);

  const deal = { id: "d", value: 10000, probability: 0.4, close_date: "2026-11-18" };
  const [d] = await withComputed(schema, deals, [deal], demoStore, NOW);
  assert.equal(d?.weighted_value, 4000);
  assert.equal(d?.days_left, 10);
});

test("demo: link labels and updates with an activity entry", async () => {
  resetDemo(NOW);
  const deals = table("deals");
  const page = await demoStore.list(deals, { filters: [], sorts: [], page: 1, pageSize: 5 });
  const labels = await linkLabels(schema, deals, page.rows, demoStore);
  const first = page.rows[0]!;
  assert.ok(labels.companies?.[String(first.company)]);
  await demoStore.update(deals, first.id, { stage: "Won" }, { id: "u-1", name: "Maya Chen" });
  assert.equal((await demoStore.get(deals, first.id))?.stage, "Won");
  assert.equal((await demoStore.activity(deals, first.id))[0]?.field, "stage");
});

test("db mapping: single links use <key>_id, many links go to junctions, computed fields are dropped", () => {
  const deals = table("deals");
  const p = patchToDb(deals, { company: "c1", contacts: ["p1", "p2"], weighted_value: 5, name: "" });
  assert.deepEqual(p.columns, { company_id: "c1", name: null });
  assert.deepEqual(p.links.map((l) => [l.field.key, l.ids]), [["contacts", ["p1", "p2"]]]);
  const r = rowFromDb(table("companies"), { id: "x", name: "N", owner_id: "u", pipeline_value: 10, created_at: "2026-01-01" });
  assert.equal(r.owner, "u");
  assert.equal(r.pipeline_value, 10);
  assert.equal(r.created, "2026-01-01");
});

test("mode: DEMO flag or missing env means demo, never a crash", () => {
  assert.deepEqual(getMode({ DEMO: "1" }), { kind: "demo", reason: "flag" });
  assert.deepEqual(getMode({}), { kind: "demo", reason: "no-env" });
  assert.equal(getMode({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }).kind, "supabase");
});

test("access mirrors app_can()", () => {
  assert.equal(canAccess(schema, "viewer", "deals", "read"), true);
  assert.equal(canAccess(schema, "viewer", "deals", "write"), false);
  assert.equal(canAccess(schema, "portal", "deals", "read"), false);
  assert.equal(canAccess(schema, "portal", "tasks", "write"), true);
  assert.equal(canAccess(schema, "pending", "tasks", "read"), false);
  assert.equal(canAccess(schema, null, "tasks", "read"), false);
});

test("demo: a table that doesn't match the sample data starts empty instead of showing wrong rows", async () => {
  resetDemo(NOW);
  const other: TableDef = { key: "deals", label: "Deals", primaryField: "deal_name", fields: [{ key: "deal_name", label: "Deal", type: "text" }], views: [{ key: "all", label: "All", type: "grid" }] };
  const page = await demoStore.list(other, { filters: [], sorts: [], page: 1, pageSize: 10 });
  assert.equal(page.total, 0);
  resetDemo(NOW);
});
