// Grid view model: columns, rows of formatted cells, pager and filter chips. Pure, tested.

import type { Labels } from "../data/computed.ts";
import type { Page, Person, Query } from "../data/types.ts";
import { findField } from "../schema/naming.ts";
import type { AppSchema, FieldDef, FieldType, SelectOption, TableDef, ViewDef } from "../schema/types.ts";
import { isEditable } from "../schema/types.ts";
import { alignOf, formatCell, type Cell, type FormatCtx } from "./format.ts";
import { hrefWith, type Params } from "./url.ts";

export interface Column {
  key: string;
  label: string;
  type: FieldType;
  align: "left" | "right" | "center";
  sort: "asc" | "desc" | null;
  sortHref: string;
  editable: boolean;
  options?: SelectOption[];
  primary: boolean;
}

export interface GridRow {
  id: string;
  href: string;
  title: string;
  cells: Cell[];
  raw: Record<string, unknown>;
}

export interface Pager {
  page: number;
  pages: number;
  total: number;
  from: number;
  to: number;
  prevHref: string | null;
  nextHref: string | null;
}

export interface FilterChip {
  label: string;
  removeHref: string | null;
}

export interface GridView {
  columns: Column[];
  rows: GridRow[];
  pager: Pager;
  filters: FilterChip[];
  notices: string[];
  search: string;
}

/** Simple types are edited in the grid; links and long text open the record. */
const INLINE: FieldType[] = ["text", "email", "url", "phone", "number", "currency", "percent", "checkbox", "select", "date", "rating", "user"];

export function columnsFor(t: TableDef, v: ViewDef): FieldDef[] {
  const keys = v.columns?.length ? v.columns : t.fields.map((f) => f.key);
  const fields = keys.map((k) => findField(t, k)).filter((f): f is FieldDef => Boolean(f));
  const primary = findField(t, t.primaryField);
  return primary && !keys.includes(primary.key) ? [primary, ...fields] : fields;
}

const OP_TEXT: Record<string, string> = {
  eq: "is", neq: "is not", contains: "contains", gt: ">", gte: "≥", lt: "<", lte: "≤", empty: "is empty", notEmpty: "is not empty", in: "is any of",
};

export function filterLabel(t: TableDef, field: string, op: string, value: unknown): string {
  const label = findField(t, field)?.label ?? field;
  const v = value === undefined ? "" : ` ${Array.isArray(value) ? value.join(", ") : value === "$today" ? "today" : String(value)}`;
  return `${label} ${OP_TEXT[op] ?? op}${v}`;
}

export function filterChips(t: TableDef, v: ViewDef, base: string, params: Params): FilterChip[] {
  const fixed = (v.filters ?? []).map((f) => ({ label: filterLabel(t, f.field, f.op, f.value), removeHref: null }));
  const raw = params.f === undefined ? [] : Array.isArray(params.f) ? params.f : [params.f];
  const extra = raw.map((s) => {
    const [field = "", op = "", ...rest] = s.split(":");
    return { label: filterLabel(t, field, op, rest.length ? rest.join(":") : undefined), removeHref: hrefWith(base, params, { f: raw.filter((x) => x !== s) }) };
  });
  return [...fixed, ...extra];
}

function pager(page: Page, base: string, params: Params): Pager {
  const pages = Math.max(1, Math.ceil(page.total / page.pageSize));
  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  return {
    page: page.page,
    pages,
    total: page.total,
    from,
    to: Math.min(page.total, page.page * page.pageSize),
    prevHref: page.page > 1 ? hrefWith(base, params, { p: String(page.page - 1) }) : null,
    nextHref: page.page < pages ? hrefWith(base, params, { p: String(page.page + 1) }) : null,
  };
}

export interface GridInput {
  schema: AppSchema;
  table: TableDef;
  view: ViewDef;
  page: Page;
  query: Query;
  labels: Labels;
  people: Person[];
  canWrite: boolean;
  base: string;
  params: Params;
}

export function toGridView(i: GridInput): GridView {
  const ctx: FormatCtx = { labels: i.labels, people: new Map(i.people.map((p) => [p.id, p])), currency: i.schema.app.currency ?? "USD", locale: i.schema.app.locale ?? "en-US" };
  const fields = columnsFor(i.table, i.view);
  const sort = i.query.sorts[0];
  const rows: GridRow[] = i.page.rows.map((r) => ({
    id: r.id,
    href: `/t/${i.table.key}/r/${r.id}`,
    title: String(r[i.table.primaryField] ?? "") || "Untitled",
    cells: fields.map((f) => formatCell(f, r[f.key], ctx)),
    raw: Object.fromEntries(fields.filter((f) => INLINE.includes(f.type)).map((f) => [f.key, r[f.key] ?? null])),
  }));
  const columns: Column[] = fields.map((f, idx) => {
    const current = sort?.field === f.key ? sort.dir : null;
    const col: Column = {
      key: f.key,
      label: f.label,
      type: f.type,
      align: alignOf(f, rows.map((r) => r.cells[idx] as Cell)),
      sort: current,
      sortHref: hrefWith(i.base, i.params, { s: `${f.key}:${current === "asc" ? "desc" : "asc"}` }),
      editable: i.canWrite && isEditable(f) && INLINE.includes(f.type),
      primary: f.key === i.table.primaryField,
    };
    if (f.options) col.options = f.options;
    return col;
  });
  return { columns, rows, pager: pager(i.page, i.base, i.params), filters: filterChips(i.table, i.view, i.base, i.params), notices: i.page.notices, search: i.query.search ?? "" };
}
