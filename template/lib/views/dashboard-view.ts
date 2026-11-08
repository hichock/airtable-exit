// Dashboard view model: stat tiles and single-series bar charts from app.schema.json. Pure, tested.

import { matchFilter } from "../data/query.ts";
import type { Row } from "../data/types.ts";
import { findField, findTable } from "../schema/naming.ts";
import type { AppSchema, ChartDef, DashboardDef, FieldDef, TileDef } from "../schema/types.ts";
import { formatNumber } from "./format.ts";

export interface TileVM { label: string; value: string; sub: string; href: string }
export interface BarVM { label: string; value: number; display: string; pct: number }
export interface ChartVM { label: string; bars: BarVM[]; total: string; empty: boolean }
export interface DashboardVM { label: string; tiles: TileVM[]; charts: ChartVM[] }

type Rows = Record<string, Row[]>;

function fmt(s: AppSchema, f: FieldDef | undefined, n: number): string {
  const ctx = { currency: s.app.currency ?? "USD", locale: s.app.locale ?? "en-US" };
  return f ? formatNumber({ ...f, precision: f.type === "currency" ? 0 : f.precision }, n, ctx) : new Intl.NumberFormat(ctx.locale).format(n);
}

function metric(rows: Row[], m: "count" | "sum" | "avg", field?: string): number {
  if (m === "count") return rows.length;
  const nums = rows
    .map((r) => r[field ?? ""])
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter((n) => Number.isFinite(n));
  const sum = nums.reduce((a, b) => a + b, 0);
  return m === "sum" ? sum : nums.length ? sum / nums.length : 0;
}

export function tileVM(s: AppSchema, t: TileDef, rows: Rows, now = new Date()): TileVM {
  const table = findTable(s.tables, t.table);
  const subset = (rows[t.table] ?? []).filter((r) => (t.filters ?? []).every((f) => matchFilter(r, f, now)));
  const value = metric(subset, t.metric, t.field);
  const field = t.metric === "count" ? undefined : table && findField(table, t.field ?? "");
  const noun = (table?.label ?? t.table).toLowerCase();
  return {
    label: t.label,
    value: fmt(s, field, value),
    sub: t.metric === "count" ? `of ${(rows[t.table] ?? []).length} ${noun}` : `${subset.length} ${noun}`,
    href: `/t/${t.table}`,
  };
}

export function chartVM(s: AppSchema, c: ChartDef, rows: Rows, now = new Date()): ChartVM {
  const table = findTable(s.tables, c.table);
  const group = table ? findField(table, c.groupBy) : undefined;
  const field = c.metric === "sum" && table ? findField(table, c.field ?? "") : undefined;
  const subset = (rows[c.table] ?? []).filter((r) => (c.filters ?? []).every((f) => matchFilter(r, f, now)));
  const order = group?.options?.map((o) => o.value) ?? [];
  const keys = [...new Set([...order, ...subset.map((r) => String(r[c.groupBy] ?? "") || "(empty)")])];
  const values = keys
    .map((k) => ({ label: k, value: metric(subset.filter((r) => (String(r[c.groupBy] ?? "") || "(empty)") === k), c.metric, c.field) }))
    .filter((b) => b.value !== 0 || order.includes(b.label));
  // Select fields keep their own order (a pipeline reads left to right); other groups rank by value.
  if (!order.length) values.sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...values.map((b) => b.value));
  const total = values.reduce((a, b) => a + b.value, 0);
  return {
    label: c.label,
    bars: values.map((b) => ({ ...b, display: fmt(s, field, b.value), pct: max ? Math.round((b.value / max) * 1000) / 10 : 0 })),
    total: fmt(s, field, total),
    empty: total === 0,
  };
}

export function toDashboardView(s: AppSchema, d: DashboardDef, rows: Rows, now = new Date()): DashboardVM {
  return { label: d.label, tiles: d.tiles.map((t) => tileVM(s, t, rows, now)), charts: d.charts.map((c) => chartVM(s, c, rows, now)) };
}

/** Tables a dashboard needs, so the page loads each once. */
export function tablesOf(d: DashboardDef): string[] {
  return [...new Set([...d.tiles.map((t) => t.table), ...d.charts.map((c) => c.table)])];
}
