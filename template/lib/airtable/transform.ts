// Airtable record → typed row values, link ids and attachments. Pure, tested.
// Fields are matched by Airtable field id (field.airtable.id in app.schema.json).

import type { AirtableAttachment, AirtableRecord } from "./client.ts";
import type { FieldDef, TableDef } from "../schema/types.ts";

export interface Transformed {
  values: Record<string, unknown>;
  links: { field: string; airtableIds: string[] }[];
  attachments: { field: string; items: AirtableAttachment[] }[];
  unmatchedUsers: string[];
  warnings: string[];
}

export interface TransformCtx {
  /** Airtable user id or email (lower case) → profile uuid. */
  people: Map<string, string>;
}

const COMPUTED = ["formula", "lookup", "rollup"];

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function person(v: unknown, ctx: TransformCtx, unmatched: string[]): string | null {
  if (!v || typeof v !== "object") return null;
  const c = v as { id?: string; email?: string; name?: string };
  const id = (c.id && ctx.people.get(c.id)) || (c.email && ctx.people.get(c.email.toLowerCase()));
  if (!id) unmatched.push(c.email ?? c.name ?? c.id ?? "unknown");
  return id || null;
}

function convert(f: FieldDef, v: unknown, ctx: TransformCtx, unmatched: string[]): unknown {
  switch (f.type) {
    case "number": case "currency": case "percent": case "rating": case "autoNumber": return num(v);
    case "checkbox": return v === true;
    case "multiSelect": return Array.isArray(v) ? v.map(String) : [];
    case "select": return text(typeof v === "object" && v !== null ? (v as { name?: string }).name : v);
    case "date": return text(v)?.slice(0, 10) ?? null;
    case "dateTime": case "createdTime": case "updatedTime": return text(v);
    case "user": return person(Array.isArray(v) ? v[0] : v, ctx, unmatched);
    case "json": return v ?? null;
    default: return text(typeof v === "object" && v !== null ? JSON.stringify(v) : v);
  }
}

export function transformRecord(t: TableDef, rec: AirtableRecord, ctx: TransformCtx): Transformed {
  const out: Transformed = { values: {}, links: [], attachments: [], unmatchedUsers: [], warnings: [] };
  for (const f of t.fields) {
    const atId = f.airtable?.id;
    if (!atId || COMPUTED.includes(f.type)) continue;
    const v = rec.fields[atId];
    if (f.type === "link") { out.links.push({ field: f.key, airtableIds: Array.isArray(v) ? v.map(String) : [] }); continue; }
    if (f.type === "attachment") { out.attachments.push({ field: f.key, items: Array.isArray(v) ? (v as AirtableAttachment[]) : [] }); continue; }
    if (f.type === "user" && Array.isArray(v) && v.length > 1) out.warnings.push(`${f.key}: ${v.length} people in a single-person field; kept the first`);
    out.values[f.key] = convert(f, v, ctx, out.unmatchedUsers);
  }
  // Keep Airtable's creation time instead of "now" (decision: import the value, don't reset it).
  if (!t.fields.some((f) => f.type === "createdTime" && f.airtable)) out.values.__created_at = rec.createdTime;
  return out;
}

/** Normalise a value for parity diffs: dates to day, empty → null, arrays sorted, numbers rounded. */
export function normalize(v: unknown): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0) || v === false) return "∅";
  if (Array.isArray(v)) return JSON.stringify(v.map((x) => normalize(x)).sort());
  if (typeof v === "number") return String(Math.round(v * 1e6) / 1e6);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return new Date(v).toISOString();
  return String(v).trim();
}

/** Field keys whose values differ between the Airtable-side values and the database row. */
export function diffValues(expected: Record<string, unknown>, actual: Record<string, unknown>): string[] {
  return Object.keys(expected).filter((k) => !k.startsWith("__") && normalize(expected[k]) !== normalize(actual[k]));
}

/** Deterministic sample of n items (seeded), so a parity run can be repeated. */
export function sample<T>(xs: T[], n: number, seed = 7): T[] {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a.slice(0, n);
}

/** Storage object path for an attachment: <table>/<airtable record id>/<attachment id>-<safe filename>. */
export function attachmentPath(tableKey: string, recordAirtableId: string, a: AirtableAttachment): string {
  const safe = a.filename.replace(/[^\w.\-]+/g, "_").slice(0, 120);
  return `${tableKey}/${recordAirtableId}/${a.id}-${safe}`;
}
