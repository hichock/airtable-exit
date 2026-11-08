// URL state for views: ?q=search&s=field:asc&f=field:op:value&p=2&m=2026-11
import type { Filter, FilterOp, Sort, ViewDef } from "../schema/types.ts";
import type { Query } from "../data/types.ts";

export type Params = Record<string, string | string[] | undefined>;

const OPS: FilterOp[] = ["eq", "neq", "contains", "gt", "gte", "lt", "lte", "empty", "notEmpty"];

function list(v: string | string[] | undefined): string[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

export function parseFilter(s: string): Filter | null {
  const [field, op, ...rest] = s.split(":");
  if (!field || !op || !OPS.includes(op as FilterOp)) return null;
  const f: Filter = { field, op: op as FilterOp };
  if (op !== "empty" && op !== "notEmpty") f.value = rest.join(":");
  return f;
}

export function parseSort(s: string | undefined): Sort | null {
  if (!s) return null;
  const [field, dir] = s.split(":");
  return field ? { field, dir: dir === "desc" ? "desc" : "asc" } : null;
}

/** View filters always apply (like an Airtable view); URL filters add to them. A URL sort replaces the view's. */
export function queryFromParams(view: ViewDef, params: Params): Query {
  const urlFilters = list(params.f).map(parseFilter).filter((f): f is Filter => f !== null);
  const sort = parseSort(list(params.s)[0]);
  const page = Math.max(1, Number.parseInt(list(params.p)[0] ?? "1", 10) || 1);
  const search = list(params.q)[0]?.slice(0, 200);
  const q: Query = { filters: [...(view.filters ?? []), ...urlFilters], sorts: sort ? [sort] : (view.sorts ?? []), page, pageSize: view.pageSize ?? 50 };
  if (search) q.search = search;
  return q;
}

/** Builds a link to the same view with some params changed (null removes). Resets the page unless set. */
export function hrefWith(base: string, params: Params, changes: Record<string, string | string[] | null>): string {
  const sp = new URLSearchParams();
  const merged: Params = { ...params };
  if (!("p" in changes)) delete merged.p;
  for (const [k, v] of Object.entries(changes)) merged[k] = v === null ? undefined : v;
  for (const [k, v] of Object.entries(merged)) for (const x of list(v)) if (x !== "") sp.append(k, x);
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
