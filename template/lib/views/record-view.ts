// Record page view model: fields, links in both directions, files, comments, activity. Pure, tested.

import type { Labels } from "../data/computed.ts";
import type { ActivityItem, AttachmentItem, CommentItem, Person, Row } from "../data/types.ts";
import { findField } from "../schema/naming.ts";
import type { AppSchema, FieldDef, FieldType, SelectOption, TableDef } from "../schema/types.ts";
import { isComputed, isEditable } from "../schema/types.ts";
import { cellText, formatCell, formatDate, type Cell, type FormatCtx } from "./format.ts";

export interface FieldVM {
  key: string;
  label: string;
  type: FieldType;
  cell: Cell;
  raw: unknown;
  editable: boolean;
  computedNote?: string;
  options?: SelectOption[];
  linkTable?: string;
  multiple?: boolean;
}

export interface BacklinkGroup {
  table: string;
  tableLabel: string;
  via: string;
  rows: { id: string; href: string; title: string; summary: string }[];
  total: number;
}

export interface RecordVM {
  title: string;
  tableLabel: string;
  singular: string;
  fields: FieldVM[];
  backlinks: BacklinkGroup[];
  files: (AttachmentItem & { fieldLabel: string; sizeText: string })[];
  comments: CommentItem[];
  activity: (ActivityItem & { text: string; when: string })[];
}

export const BACKLINK_LIMIT = 25;

/** Every link field in the schema that points at this table: the "linked from" side. */
export function incomingLinks(s: AppSchema, t: TableDef): { table: TableDef; field: FieldDef }[] {
  return s.tables.flatMap((src) => src.fields.filter((f) => f.type === "link" && f.link?.table === t.key).map((field) => ({ table: src, field })));
}

export function sizeText(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function note(f: FieldDef): string | undefined {
  const c = f.computed;
  if (!c) return isComputed(f) ? "Set by the system" : undefined;
  if (c.kind === "formula") return c.note ?? `Formula: ${c.expr}`;
  if (c.kind === "lookup") return `From ${c.via} → ${c.field}`;
  return c.note ?? `${c.fn} of ${c.table}${c.field ? `.${c.field}` : ""}`;
}

function activityText(a: ActivityItem, t: TableDef): string {
  if (a.action === "update" && a.field) {
    const label = findField(t, a.field)?.label ?? a.field;
    const v = a.newValue === null || a.newValue === undefined || a.newValue === "" ? "empty" : Array.isArray(a.newValue) ? `${a.newValue.length} linked` : String(a.newValue);
    return `changed ${label} to ${v}`;
  }
  const verbs: Record<string, string> = { create: "created this record", import: "imported this record from Airtable", sync: "synced this record from Airtable", automation: "ran an automation", delete: "deleted this record" };
  return verbs[a.action] ?? a.action;
}

export interface RecordInput {
  schema: AppSchema;
  table: TableDef;
  row: Row;
  labels: Labels;
  people: Person[];
  canWrite: boolean;
  backlinks: { table: TableDef; field: FieldDef; rows: Row[] }[];
  files: AttachmentItem[];
  comments: CommentItem[];
  activity: ActivityItem[];
}

export function toRecordView(i: RecordInput): RecordVM {
  const ctx: FormatCtx = { labels: i.labels, people: new Map(i.people.map((p) => [p.id, p])), currency: i.schema.app.currency ?? "USD", locale: i.schema.app.locale ?? "en-US" };
  const fields: FieldVM[] = i.table.fields
    .filter((f) => f.key !== i.table.primaryField && f.type !== "attachment")
    .map((f) => {
      const vm: FieldVM = { key: f.key, label: f.label, type: f.type, cell: formatCell(f, i.row[f.key], ctx), raw: i.row[f.key] ?? null, editable: i.canWrite && isEditable(f) };
      const n = note(f);
      if (n) vm.computedNote = n;
      if (f.options) vm.options = f.options;
      if (f.link) { vm.linkTable = f.link.table; vm.multiple = f.link.multiple; }
      return vm;
    });
  const backlinks = i.backlinks.map(({ table, field, rows }) => {
    const summaryFields = table.fields.filter((f) => f.type === "select" || f.type === "currency" || f.type === "date").slice(0, 2);
    return {
      table: table.key,
      tableLabel: table.label,
      via: field.label,
      total: rows.length,
      rows: rows.slice(0, BACKLINK_LIMIT).map((r) => ({
        id: r.id,
        href: `/t/${table.key}/r/${r.id}`,
        title: String(r[table.primaryField] ?? "") || "Untitled",
        summary: summaryFields.map((f) => cellText(formatCell(f, r[f.key], ctx))).filter(Boolean).join(" · "),
      })),
    };
  });
  return {
    title: String(i.row[i.table.primaryField] ?? "") || "Untitled",
    tableLabel: i.table.label,
    singular: i.table.singular ?? i.table.label,
    fields,
    backlinks,
    files: i.files.map((f) => ({ ...f, fieldLabel: findField(i.table, f.field)?.label ?? f.field, sizeText: sizeText(f.size) })),
    comments: i.comments,
    activity: i.activity.map((a) => ({ ...a, text: activityText(a, i.table), when: formatDate(a.createdAt, true, ctx.locale) })),
  };
}
