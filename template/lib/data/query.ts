// Filter, search, sort and page rows in memory. Used by DEMO mode and by tests; the Supabase
// store does the same work in SQL. Semantics follow Airtable: "is not" includes empty cells,
// and "is" on a multi-value cell means "has".

import type { Filter, FilterValue, Sort, TableDef } from "../schema/types.ts";
import type { Page, Query, Row } from "./types.ts";

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resolveValue(v: FilterValue | undefined, now: Date): FilterValue | undefined {
  return v === "$today" ? todayIso(now) : v;
}

export function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return Number(Boolean(a)) - Number(Boolean(b));
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

function equals(cell: unknown, v: FilterValue | undefined): boolean {
  if (Array.isArray(cell)) return cell.some((c) => norm(c) === norm(v));
  if (typeof cell === "boolean") return cell === (v === true || v === "true");
  if (typeof cell === "number") return cell === Number(v);
  return norm(cell) === norm(v);
}

export function matchFilter(row: Row, f: Filter, now: Date = new Date()): boolean {
  const cell = row[f.field];
  const v = resolveValue(f.value, now);
  switch (f.op) {
    case "empty": return isEmpty(cell);
    case "notEmpty": return !isEmpty(cell);
    case "eq": return equals(cell, v);
    case "neq": return !equals(cell, v);
    case "contains": return norm(Array.isArray(cell) ? cell.join(" ") : cell).includes(norm(v));
    case "in": return Array.isArray(v) && v.some((x) => equals(cell, x));
    default: {
      if (isEmpty(cell)) return false;
      const c = cmp(cell, typeof cell === "number" ? Number(v) : v);
      return f.op === "gt" ? c > 0 : f.op === "gte" ? c >= 0 : f.op === "lt" ? c < 0 : c <= 0;
    }
  }
}

export function sortRows(rows: Row[], sorts: Sort[]): Row[] {
  if (!sorts.length) return rows;
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const av = a[s.field], bv = b[s.field];
      if (isEmpty(av) && isEmpty(bv)) continue;
      if (isEmpty(av)) return 1; // empty cells last, either direction
      if (isEmpty(bv)) return -1;
      const c = cmp(av, bv);
      if (c !== 0) return s.dir === "asc" ? c : -c;
    }
    return a.id.localeCompare(b.id);
  });
}

export function applyQuery(rows: Row[], table: TableDef, q: Query, now: Date = new Date()): Page {
  const search = q.search?.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => q.filters.every((f) => matchFilter(r, f, now)) && (!search || norm(r[table.primaryField]).includes(search)),
  );
  const sorted = sortRows(filtered, q.sorts);
  const start = (q.page - 1) * q.pageSize;
  return { rows: sorted.slice(start, start + q.pageSize), total: sorted.length, page: q.page, pageSize: q.pageSize, notices: [] };
}
