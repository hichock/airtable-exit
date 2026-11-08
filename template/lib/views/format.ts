// One cell value → what the UI shows. Pure, so every view (grid, cards, kanban, record) agrees.

import type { Labels } from "../data/computed.ts";
import { idsOf } from "../data/computed.ts";
import type { Person } from "../data/types.ts";
import type { ChipColor, FieldDef } from "../schema/types.ts";

export type Cell =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "number"; text: string }
  | { kind: "href"; text: string; href: string; external: boolean }
  | { kind: "chips"; chips: { label: string; color: ChipColor }[] }
  | { kind: "records"; items: { id: string; label: string; href: string }[] }
  | { kind: "check"; on: boolean }
  | { kind: "user"; name: string; initials: string }
  | { kind: "rating"; value: number; max: number };

export interface FormatCtx {
  labels: Labels;
  people: Map<string, Person>;
  currency: string;
  locale: string;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

export function formatNumber(f: FieldDef, n: number, ctx: Pick<FormatCtx, "currency" | "locale">): string {
  const digits = f.precision ?? (f.type === "currency" ? 2 : undefined);
  const opts: Intl.NumberFormatOptions = digits === undefined ? {} : { minimumFractionDigits: digits, maximumFractionDigits: digits };
  if (f.type === "currency") return new Intl.NumberFormat(ctx.locale, { style: "currency", currency: f.currency ?? ctx.currency, ...opts }).format(n);
  if (f.type === "percent") return new Intl.NumberFormat(ctx.locale, { style: "percent", maximumFractionDigits: f.precision ?? 0 }).format(n);
  return new Intl.NumberFormat(ctx.locale, opts).format(n);
}

export function formatDate(v: string, withTime: boolean, locale: string): string {
  const d = new Date(withTime ? v : `${v.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

function chipColor(f: FieldDef, value: string): ChipColor {
  return f.options?.find((o) => o.value === value)?.color ?? "gray";
}

function numeric(f: FieldDef): boolean {
  return ["number", "currency", "percent", "autoNumber", "rollup"].includes(f.type);
}

export function formatCell(f: FieldDef, value: unknown, ctx: FormatCtx): Cell {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return f.type === "checkbox" ? { kind: "check", on: false } : { kind: "empty" };
  }
  switch (f.type) {
    case "checkbox": return { kind: "check", on: value === true };
    case "select": return { kind: "chips", chips: [{ label: String(value), color: chipColor(f, String(value)) }] };
    case "multiSelect": return { kind: "chips", chips: (value as unknown[]).map((v) => ({ label: String(v), color: chipColor(f, String(v)) })) };
    case "url": return { kind: "href", text: String(value).replace(/^https?:\/\//, ""), href: String(value), external: true };
    case "email": return { kind: "href", text: String(value), href: `mailto:${String(value)}`, external: true };
    case "phone": return { kind: "href", text: String(value), href: `tel:${String(value).replace(/\s/g, "")}`, external: true };
    case "date": return { kind: "text", text: formatDate(String(value), false, ctx.locale) };
    case "dateTime": case "createdTime": case "updatedTime": return { kind: "text", text: formatDate(String(value), true, ctx.locale) };
    case "rating": return { kind: "rating", value: Number(value), max: f.max ?? 5 };
    case "user": {
      const p = ctx.people.get(String(value));
      const name = p?.name ?? "Unknown person";
      return { kind: "user", name, initials: initials(name) };
    }
    case "link": {
      const target = f.link?.table ?? "";
      const items = idsOf(value).map((id) => ({ id, label: ctx.labels[target]?.[id] ?? "Unknown record", href: `/t/${target}/r/${id}` }));
      return { kind: "records", items };
    }
    case "lookup": {
      const vals = Array.isArray(value) ? value : [value];
      return { kind: "text", text: vals.map(String).join(", ") };
    }
    case "attachment": return { kind: "text", text: `${(value as unknown[]).length} file(s)` };
    case "json": return { kind: "text", text: JSON.stringify(value) };
    default: {
      if (typeof value === "number" && numeric(f)) return { kind: "number", text: formatNumber(f, value, ctx) };
      // A formula with "currency" set shows money; otherwise a plain number.
      if (typeof value === "number" && f.type === "formula") return { kind: "number", text: formatNumber({ ...f, type: f.currency ? "currency" : "number", precision: f.precision ?? 0 }, value, ctx) };
      if (typeof value === "boolean") return { kind: "check", on: value };
      return { kind: "text", text: String(value) };
    }
  }
}

/** Plain text of a cell, for titles, tooltips and tests. */
export function cellText(c: Cell): string {
  switch (c.kind) {
    case "empty": return "";
    case "text": case "number": case "href": return c.text;
    case "chips": return c.chips.map((x) => x.label).join(", ");
    case "records": return c.items.map((x) => x.label).join(", ");
    case "check": return c.on ? "Yes" : "No";
    case "user": return c.name;
    case "rating": return `${c.value}/${c.max}`;
  }
}

/** Column alignment: numbers right, checkboxes centred. Formulas follow what they actually return. */
export function alignOf(f: FieldDef, cells: Cell[] = []): "left" | "right" | "center" {
  if (f.type === "checkbox") return "center";
  if (numeric(f) || f.type === "rating") return "right";
  const filled = cells.filter((c) => c.kind !== "empty");
  return f.type === "formula" && filled.length > 0 && filled.every((c) => c.kind === "number") ? "right" : "left";
}
