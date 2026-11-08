// Kanban and calendar view models. Pure, tested.

import type { Labels } from "../data/computed.ts";
import type { Person, Row } from "../data/types.ts";
import { findField } from "../schema/naming.ts";
import type { AppSchema, ChipColor, TableDef, ViewDef } from "../schema/types.ts";
import { formatCell, type Cell, type FormatCtx } from "./format.ts";

export const CARDS_PER_COLUMN = 200;

export interface Card {
  id: string;
  href: string;
  title: string;
  meta: { label: string; cell: Cell }[];
}

export interface KanbanColumn {
  value: string | null;
  label: string;
  color: ChipColor;
  cards: Card[];
  count: number;
  hidden: number;
}

export interface KanbanView {
  field: string;
  columns: KanbanColumn[];
}

function ctxOf(s: AppSchema, labels: Labels, people: Person[]): FormatCtx {
  return { labels, people: new Map(people.map((p) => [p.id, p])), currency: s.app.currency ?? "USD", locale: s.app.locale ?? "en-US" };
}

function card(t: TableDef, v: ViewDef, r: Row, ctx: FormatCtx): Card {
  const meta = (v.cardFields ?? [])
    .map((k) => findField(t, k))
    .filter((f) => f !== undefined)
    .map((f) => ({ label: f.label, cell: formatCell(f, r[f.key], ctx) }))
    .filter((m) => m.cell.kind !== "empty");
  return { id: r.id, href: `/t/${t.key}/r/${r.id}`, title: String(r[t.primaryField] ?? "") || "Untitled", meta };
}

export function toKanbanView(s: AppSchema, t: TableDef, v: ViewDef, rows: Row[], labels: Labels, people: Person[]): KanbanView {
  const field = findField(t, v.by ?? "");
  const ctx = ctxOf(s, labels, people);
  const opts = field?.options ?? [];
  const known = new Set(opts.map((o) => o.value));
  const groups: { value: string | null; label: string; color: ChipColor; rows: Row[] }[] = [
    ...opts.map((o) => ({ value: o.value, label: o.value, color: o.color ?? ("gray" as ChipColor), rows: rows.filter((r) => r[field?.key ?? ""] === o.value) })),
    { value: null, label: `No ${field?.label.toLowerCase() ?? "value"}`, color: "gray", rows: rows.filter((r) => !known.has(String(r[field?.key ?? ""] ?? ""))) },
  ];
  const columns = groups
    .filter((g) => g.value !== null || g.rows.length > 0)
    .map((g) => ({
      value: g.value,
      label: g.label,
      color: g.color,
      count: g.rows.length,
      hidden: Math.max(0, g.rows.length - CARDS_PER_COLUMN),
      cards: g.rows.slice(0, CARDS_PER_COLUMN).map((r) => card(t, v, r, ctx)),
    }));
  return { field: field?.key ?? "", columns };
}

export interface CalendarDay {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  items: { id: string; href: string; title: string; color: ChipColor }[];
}

export interface CalendarView {
  month: string;
  title: string;
  prevMonth: string;
  nextMonth: string;
  weeks: CalendarDay[][];
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

export function parseMonth(v: string | undefined, now: Date): string {
  return v && /^\d{4}-\d{2}$/.test(v) ? v : now.toISOString().slice(0, 7);
}

/** Month grid, Monday first. `rows` are the records dated in or near this month. */
export function toCalendarView(s: AppSchema, t: TableDef, v: ViewDef, rows: Row[], month: string, now: Date): CalendarView {
  const by = v.by ?? "";
  const colorField = t.fields.find((f) => f.type === "select");
  const colorOf = (r: Row): ChipColor => colorField?.options?.find((o) => o.value === r[colorField.key])?.color ?? "gray";
  const { start } = monthRange(month);
  const first = new Date(`${start}T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - offset * 86_400_000);
  const today = now.toISOString().slice(0, 10);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getTime() + (w * 7 + d) * 86_400_000).toISOString().slice(0, 10);
      week.push({
        date,
        day: Number(date.slice(8, 10)),
        inMonth: date.startsWith(month),
        isToday: date === today,
        items: rows.filter((r) => String(r[by] ?? "").slice(0, 10) === date).map((r) => ({ id: r.id, href: `/t/${t.key}/r/${r.id}`, title: String(r[t.primaryField] ?? "Untitled"), color: colorOf(r) })),
      });
    }
    if (w >= 4 && !week.some((d) => d.inMonth)) break;
    weeks.push(week);
  }
  const title = new Intl.DateTimeFormat(s.app.locale ?? "en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  return { month, title, prevMonth: shiftMonth(month, -1), nextMonth: shiftMonth(month, 1), weeks };
}
