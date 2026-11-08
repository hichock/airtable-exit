// Row (field keys) ↔ database row (column names). Pure; the Supabase store and the migration use it.

import { columnOf } from "../schema/naming.ts";
import type { FieldDef, TableDef } from "../schema/types.ts";
import type { Row } from "./types.ts";

/** Lookups and rollups come from the <table>_computed view under their own key. */
export function readColumn(f: FieldDef): string | null {
  if (f.type === "lookup" || f.type === "rollup") return f.key;
  return columnOf(f);
}

export function hasComputedView(t: TableDef): boolean {
  return t.fields.some((f) => f.type === "lookup" || f.type === "rollup");
}

export function rowFromDb(t: TableDef, r: Record<string, unknown>): Row {
  const row: Row = { id: String(r.id) };
  if (typeof r.created_at === "string") row.created_at = r.created_at;
  if (typeof r.updated_at === "string") row.updated_at = r.updated_at;
  for (const f of t.fields) {
    const c = readColumn(f);
    if (c && c in r) row[f.key] = r[c] ?? null;
  }
  return row;
}

export interface DbPatch {
  columns: Record<string, unknown>;
  links: { field: FieldDef; ids: string[] }[];
}

/** Splits a patch into column values and many-to-many link sets. Unknown or computed fields are dropped. */
export function patchToDb(t: TableDef, patch: Record<string, unknown>): DbPatch {
  const out: DbPatch = { columns: {}, links: [] };
  for (const [key, value] of Object.entries(patch)) {
    const f = t.fields.find((x) => x.key === key);
    if (!f || ["formula", "lookup", "rollup", "autoNumber", "createdTime", "updatedTime", "attachment"].includes(f.type)) continue;
    if (f.type === "link" && f.link?.multiple) {
      out.links.push({ field: f, ids: Array.isArray(value) ? value.map(String) : [] });
      continue;
    }
    const c = columnOf(f);
    if (c) out.columns[c] = value === "" ? null : value;
  }
  return out;
}
