// Fills lookups, rollups and app formulas for a page of rows, and resolves link labels.
// Generated formulas already come from Postgres; in DEMO mode every formula is evaluated here.

import { evaluateFormula } from "../formula/evaluate.ts";
import { FormulaError } from "../formula/parse.ts";
import { findField, findTable } from "../schema/naming.ts";
import type { AppSchema, FieldDef, RollupFn, TableDef } from "../schema/types.ts";
import type { Row, Store } from "./types.ts";

export type Labels = Record<string, Record<string, string>>;

export function idsOf(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" && v ? [v] : [];
}

export function aggregate(fn: RollupFn, values: unknown[]): number | null {
  if (fn === "count") return values.length;
  const nums = values.map(Number).filter((n) => Number.isFinite(n));
  if (fn === "sum") return nums.reduce((a, b) => a + b, 0);
  if (!nums.length) return null;
  if (fn === "avg") return nums.reduce((a, b) => a + b, 0) / nums.length;
  return fn === "min" ? Math.min(...nums) : Math.max(...nums);
}

async function fillLookup(s: AppSchema, t: TableDef, f: FieldDef, rows: Row[], store: Store): Promise<void> {
  if (f.computed?.kind !== "lookup") return;
  const via = findField(t, f.computed.via);
  const target = via?.link ? findTable(s.tables, via.link.table) : undefined;
  if (!via || !target) return;
  const ids = [...new Set(rows.flatMap((r) => idsOf(r[via.key])))];
  const byId = new Map((await store.byIds(target, ids)).map((r) => [r.id, r]));
  const field = f.computed.field;
  for (const r of rows) {
    const vals = idsOf(r[via.key]).map((id) => byId.get(id)?.[field]).filter((v) => v !== undefined && v !== null);
    r[f.key] = via.link?.multiple ? vals : (vals[0] ?? null);
  }
}

async function fillRollup(s: AppSchema, f: FieldDef, rows: Row[], store: Store): Promise<void> {
  const c = f.computed;
  if (c?.kind !== "rollup") return;
  const src = findTable(s.tables, c.table);
  const link = src ? findField(src, c.linkField) : undefined;
  if (!src || !link) return;
  const related = await store.linking(src, link, rows.map((r) => r.id));
  for (const r of rows) {
    const mine = related.filter((x) => idsOf(x[link.key]).includes(r.id));
    r[f.key] = aggregate(c.fn, c.fn === "count" ? mine : mine.map((x) => x[c.field ?? ""]).filter((v) => v !== null && v !== undefined));
  }
}

function fillFormulas(t: TableDef, rows: Row[], evaluateAll: boolean, now: Date): void {
  for (const f of t.fields) {
    if (f.computed?.kind !== "formula") continue;
    if (f.computed.mode === "generated" && !evaluateAll) continue;
    for (const r of rows) {
      try {
        r[f.key] = evaluateFormula(f.computed.expr, r, now);
      } catch (e) {
        if (!(e instanceof FormulaError)) throw e;
        r[f.key] = null;
      }
    }
  }
}

export async function withComputed(s: AppSchema, t: TableDef, rows: Row[], store: Store, now = new Date()): Promise<Row[]> {
  if (!rows.length) return rows;
  // Supabase reads lookups and rollups from the <table>_computed view; DEMO computes them here.
  if (store.mode === "demo") {
    for (const f of t.fields) {
      if (f.type === "lookup") await fillLookup(s, t, f, rows, store);
      if (f.type === "rollup") await fillRollup(s, f, rows, store);
    }
  }
  fillFormulas(t, rows, store.mode === "demo", now);
  return rows;
}

/** Display names for every record linked from these rows: labels[tableKey][id]. */
export async function linkLabels(s: AppSchema, t: TableDef, rows: Row[], store: Store): Promise<Labels> {
  const labels: Labels = {};
  for (const f of t.fields) {
    if (f.type !== "link" || !f.link) continue;
    const target = findTable(s.tables, f.link.table);
    if (!target) continue;
    const ids = [...new Set(rows.flatMap((r) => idsOf(r[f.key])))];
    const found = await store.byIds(target, ids);
    const map = (labels[target.key] ??= {});
    for (const r of found) map[r.id] = String(r[target.primaryField] ?? "Untitled");
  }
  return labels;
}
