import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chipColor, draftFromBase, notesMarkdown, toKey, type AtBase } from "./map.ts";
import { validateSchema } from "../../lib/schema/validate.ts";
import { schemaToSql } from "../../lib/schema/to-sql.ts";

const inv = JSON.parse(readFileSync(new URL("./fixtures/inventory.sample.json", import.meta.url), "utf8"));
const base = inv.bases[0] as AtBase;
const draft = draftFromBase(base);
const table = (k: string) => draft.schema.tables.find((t) => t.key === k)!;
const field = (t: string, f: string) => table(t).fields.find((x) => x.key === f);

test("keys are snake_case, unique and avoid reserved names", () => {
  const taken = new Set<string>();
  assert.equal(toKey("Deal name", taken), "deal_name");
  assert.equal(toKey("Deal  Name!", taken), "deal_name_2");
  assert.equal(toKey("2024 Revenue", taken), "f_2024_revenue");
  assert.equal(toKey("Profiles", new Set(), ["profiles"]), "profiles_field");
  assert.equal(toKey("Été", new Set()), "ete");
});

test("Airtable colours map to chip colours", () => {
  assert.equal(chipColor("greenBright"), "green");
  assert.equal(chipColor("blueLight2"), "blue");
  assert.equal(chipColor("redDark1"), "red");
  assert.equal(chipColor(undefined), "gray");
});

test("the draft is a valid app.schema.json and produces SQL", () => {
  const r = validateSchema(draft.schema);
  assert.deepEqual(r.errors, []);
  assert.match(schemaToSql(draft.schema), /create table public\.deals_tags_links/);
});

test("link pairs: the single side keeps an FK, the other side is dropped; many-to-many kept once", () => {
  assert.deepEqual(field("deals", "company")?.link, { table: "companies", multiple: false });
  assert.equal(field("companies", "deals"), undefined);
  assert.deepEqual(field("deals", "tags")?.link, { table: "tags", multiple: true });
  assert.equal(field("tags", "deals"), undefined);
});

test("rollups and counts become views through the kept link; the function is flagged as guessed", () => {
  assert.deepEqual(field("companies", "pipeline")?.computed, { kind: "rollup", table: "deals", linkField: "company", fn: "sum", note: "Function guessed; confirm.", field: "value" });
  assert.deepEqual(field("companies", "deal_count")?.computed, { kind: "rollup", table: "deals", linkField: "company", fn: "count" });
  assert.ok(draft.notes.some((n) => n.field === "Pipeline" && n.level === "check" && /does not expose the rollup function/.test(n.text)));
});

test("formulas: same-row math → generated column; TODAY() → app with a reason", () => {
  assert.deepEqual(field("deals", "weighted")?.computed, { kind: "formula", expr: "{value} * {probability}", mode: "generated" });
  const age = field("deals", "age_days")?.computed;
  assert.equal(age?.kind === "formula" && age.mode, "app");
  assert.ok(draft.notes.some((n) => n.field === "Age (days)" && /no direct SQL twin|changes over time/.test(n.text)));
});

test("lookups, currency, select colours, unknown types, buttons, dropped fields", () => {
  assert.deepEqual(field("deals", "company_status")?.computed, { kind: "lookup", via: "company", field: "status" });
  assert.equal(field("deals", "value")?.currency, "EUR");
  assert.deepEqual(field("companies", "status")?.options, [{ value: "Lead", color: "gray" }, { value: "Client", color: "green" }]);
  assert.equal(field("deals", "mystery")?.type, "json");
  assert.equal(field("deals", "open_invoice"), undefined);
  assert.equal(field("companies", "old_notes"), undefined);
  assert.equal(field("deals", "owner")?.type, "user");
});

test("views: grid columns from visible fields, kanban guessed, personal dropped, form view → form", () => {
  assert.deepEqual(table("companies").views.map((v) => v.key), ["all_companies"]);
  assert.deepEqual(table("companies").views[0]?.columns, ["name", "status", "pipeline"]);
  const kan = table("deals").views.find((v) => v.key === "pipeline");
  assert.deepEqual([kan?.type, kan?.by], ["kanban", "stage"]);
  assert.equal(draft.schema.forms[0]?.table, "deals");
  assert.ok(draft.schema.roles.some((r) => r.key === "portal"));
  assert.match(notesMarkdown(draft), /^Summary: 3 tables/);
});
