import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateSchema } from "./validate.ts";
import { schemaToSql } from "./to-sql.ts";
import type { AppSchema } from "./types.ts";

const example = (): AppSchema => JSON.parse(readFileSync(new URL("../../app.schema.json", import.meta.url), "utf8"));

test("the example schema is valid", () => {
  const r = validateSchema(example());
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test("rejects a non-object and a missing app name", () => {
  assert.equal(validateSchema(null).ok, false);
  const r = validateSchema({ version: 1, app: {}, tables: [], dashboards: [], forms: [], roles: [] });
  assert.ok(r.errors.includes("app.name: required"));
});

test("catches broken references with readable paths", () => {
  const s = example();
  const deals = s.tables.find((t) => t.key === "deals")!;
  deals.views[0]!.by = "value";
  deals.fields.push({ key: "bad_link", label: "Bad", type: "link", link: { table: "nope", multiple: false } });
  deals.fields.push({ key: "bad_formula", label: "Bad", type: "formula", computed: { kind: "formula", expr: "{ghost} + 1", mode: "app" } });
  const r = validateSchema(s);
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('tables.deals.views.pipeline: kanban "by" must be a select field'));
  assert.ok(r.errors.includes("tables.deals.fields.bad_link: link.table must name an existing table"));
  assert.ok(r.errors.includes("tables.deals.fields.bad_formula: formula reads unknown field {ghost}"));
});

test("rejects reserved names, duplicate keys and missing admin role", () => {
  const s = example();
  s.tables[0]!.key = "profiles";
  s.tables[1]!.fields.push({ key: "id", label: "Id", type: "text" });
  s.tables[1]!.fields.push({ key: "name", label: "Again", type: "text" });
  s.roles = s.roles.filter((r) => r.key !== "admin");
  const r = validateSchema(s);
  assert.ok(r.errors.some((e) => e.includes('"profiles" is a reserved table name')));
  assert.ok(r.errors.some((e) => e.includes('"id" is a system column name')));
  assert.ok(r.errors.includes('tables.contacts.fields: duplicate key "name"'));
  assert.ok(r.errors.includes('roles: an "admin" role is required'));
});

test("a sum tile on a text field is an error", () => {
  const s = example();
  s.dashboards[0]!.tiles.push({ label: "Bad", table: "companies", metric: "sum", field: "name" });
  const r = validateSchema(s);
  assert.ok(r.errors.some((e) => e.includes("sum needs a number field")));
});

test("SQL: tables, links, junctions, generated formula, RLS, views, roles", () => {
  const sql = schemaToSql(example());
  assert.match(sql, /create table public\.companies \(\n  id uuid primary key default gen_random_uuid\(\),\n  airtable_id text unique,/);
  assert.match(sql, /alter table public\.contacts add column "company_id" uuid references public\.companies\(id\) on delete set null;/);
  assert.match(sql, /create table public\.deals_contacts_links \(/);
  assert.match(sql, /add column "weighted_value" numeric generated always as \(\(coalesce\("value", 0\) \* coalesce\("probability", 0\)\)\) stored;/);
  assert.match(sql, /add constraint deals_stage_check check \("stage" is null or "stage" in \('Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'\)\);/);
  assert.match(sql, /create or replace view public\.companies_computed with \(security_invoker = true\)/);
  assert.match(sql, /\(select coalesce\(sum\(r\."value"\), 0\) from public\.deals r where r\."company_id" = t\.id\) as "pipeline_value"/);
  assert.match(sql, /\(select x\."industry" from public\.companies x where x\.id = t\."company_id"\) as "company_industry"/);
  assert.match(sql, /\('portal', 'Outside user', array\['tasks'\], array\['tasks'\]\)/);
  assert.doesNotMatch(sql, /days_left/, "app formulas are not stored");
  const rls = sql.match(/enable row level security/g) ?? [];
  assert.equal(rls.length, 5, "4 tables + 1 junction");
});

test("SQL generation is deterministic", () => {
  assert.equal(schemaToSql(example()), schemaToSql(example()));
});

test("JSON Schema stays in step with the TypeScript types", () => {
  const js = JSON.parse(readFileSync(new URL("../../schema/app.schema.v1.json", import.meta.url), "utf8"));
  const enumTypes: string[] = js.$defs.field.properties.type.enum;
  const s = example();
  const used = new Set(s.tables.flatMap((t) => t.fields.map((f) => f.type)));
  for (const t of used) assert.ok(enumTypes.includes(t), `${t} missing from JSON Schema`);
  assert.equal(enumTypes.length, 24);
  assert.deepEqual(Object.keys(js.$defs.field.properties).sort(), ["airtable", "computed", "currency", "description", "key", "label", "link", "max", "options", "precision", "required", "type"]);
});
