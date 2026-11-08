import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFormula, refsOf } from "./parse.ts";
import { formulaToSql, type ColumnInfo } from "./to-sql.ts";
import { evaluateFormula } from "./evaluate.ts";

const cols: Record<string, ColumnInfo> = {
  value: { column: "value", kind: "number" },
  probability: { column: "probability", kind: "number" },
  first_name: { column: "first_name", kind: "text" },
  last_name: { column: "last_name", kind: "text" },
  close_date: { column: "close_date", kind: "date" },
  done: { column: "done", kind: "bool" },
};
const col = (k: string) => cols[k];

test("parses references and precedence", () => {
  const n = parseFormula("{value} * {probability} / 100");
  assert.deepEqual(refsOf(n), ["value", "probability"]);
  assert.equal(n.t, "bin");
});

test("arithmetic becomes SQL with blanks as 0 and safe division", () => {
  const r = formulaToSql("{value} * {probability} / 100", col);
  assert.deepEqual(r, {
    ok: true,
    kind: "number",
    sql: '((coalesce("value", 0) * coalesce("probability", 0)) / nullif(100, 0))',
  });
});

test("text concatenation uses || with blanks as empty text", () => {
  const r = formulaToSql('{first_name} & " " & {last_name}', col);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.sql, `((coalesce(("first_name")::text, '') || ' ') || coalesce(("last_name")::text, ''))`);
});

test("IF becomes CASE with Airtable truthiness", () => {
  const r = formulaToSql('IF({value} > 10000, "Large", "Small")', col);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.sql, `(case when ("value" > 10000) then 'Large' else 'Small' end)`);
});

test("string literals are escaped", () => {
  const r = formulaToSql(`CONCATENATE("O'Brien", {first_name})`, col);
  assert.equal(r.ok, true);
  if (r.ok) assert.match(r.sql, /'O''Brien'/);
});

test("TODAY() is refused for a generated column with a reason", () => {
  const r = formulaToSql("DATETIME_DIFF(TODAY(), {close_date}, 'days')", col);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /no direct SQL twin|changes over time/);
});

test("date to text is refused (not immutable in Postgres)", () => {
  const r = formulaToSql('"Closes " & {close_date}', col);
  assert.equal(r.ok, false);
});

test("unknown field and unknown function give reasons, not crashes", () => {
  const a = formulaToSql("{missing} + 1", col);
  assert.equal(a.ok, false);
  const b = formulaToSql("REGEX_MATCH({first_name}, 'a+')", col);
  assert.equal(b.ok, false);
  if (!b.ok) assert.match(b.reason, /REGEX_MATCH/);
});

test("syntax errors give reasons", () => {
  const r = formulaToSql("({value} + ", col);
  assert.equal(r.ok, false);
});

test("evaluates the same formula in TypeScript", () => {
  assert.equal(evaluateFormula("{value} * {probability} / 100", { value: 20000, probability: 40 }), 8000);
  assert.equal(evaluateFormula("{value} * {probability} / 100", { value: 20000 }), 0);
  assert.equal(evaluateFormula('{first_name} & " " & {last_name}', { first_name: "Ana" }), "Ana ");
  assert.equal(evaluateFormula('IF({value} > 10000, "Large", "Small")', { value: 500 }), "Small");
  assert.equal(evaluateFormula("ROUND(10 / 3, 2)", {}), 3.33);
  assert.equal(evaluateFormula("{value} / 0", { value: 3 }), null);
});

test("evaluates TODAY and DATETIME_DIFF with a fixed clock", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(evaluateFormula("DATETIME_DIFF(TODAY(), {close_date}, 'days')", { close_date: "2026-11-01" }, now), 7);
});
