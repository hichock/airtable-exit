// inventory.json (Airtable base schema) → draft app.schema.json + mapping notes. Pure functions.
// Mapping rules follow the type table in kb research (Airtable field model, read 2026-11-08):
// links → one relation (FK when one side is single, junction when many-to-many), lookups/rollups → SQL views,
// formulas → generated column when immutable and same-row, else computed in TypeScript and flagged.

import { formulaToSql, type SqlKind } from "../../lib/formula/to-sql.ts";
import { parseFormula, FormulaError } from "../../lib/formula/parse.ts";
import { KEY_PATTERN, RESERVED_TABLES, SYSTEM_COLUMNS } from "../../lib/schema/naming.ts";
import type { AppSchema, ChipColor, DashboardDef, FieldDef, FieldType, FormDef, RollupFn, TableDef, ViewDef } from "../../lib/schema/types.ts";

export interface AtField { id: string; name: string; type?: string; description?: string; options?: Record<string, unknown>; migrate?: boolean }
export interface AtView { id: string; name: string; type: string; visibleFieldIds?: string[]; personalForUserId?: string }
export interface AtTable { id: string; name: string; primaryFieldId: string; description?: string; fields: AtField[]; views: AtView[]; recordCount?: number; migrate?: boolean }
export interface AtBase { id: string; name: string; tables: AtTable[]; interfaces?: { id: string; name: string; collaborators?: { permissionLevel?: string }[] }[] }

export type NoteLevel = "ok" | "check" | "rebuild" | "dropped";
export interface Note { table: string; field?: string; level: NoteLevel; text: string }

export interface Draft { schema: AppSchema; notes: Note[] }

const COLORS: ChipColor[] = ["gray", "blue", "cyan", "teal", "green", "yellow", "orange", "red", "pink", "purple"];
const CURRENCY: Record<string, string> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR", "A$": "AUD", "C$": "CAD", CHF: "CHF" };

export function toKey(name: string, taken: Set<string>, reserved: readonly string[] = []): string {
  let base = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
  if (!base || !/^[a-z]/.test(base)) base = `f_${base || "field"}`;
  if (reserved.includes(base)) base = `${base}_field`;
  let key = base, n = 2;
  while (taken.has(key) || !KEY_PATTERN.test(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

export function chipColor(airtableColor: unknown): ChipColor {
  const hue = String(airtableColor ?? "").replace(/(Light|Dark|Bright)\d?$/, "").replace(/\d+$/, "");
  return COLORS.includes(hue as ChipColor) ? (hue as ChipColor) : "gray";
}

const SIMPLE: Record<string, FieldType> = {
  singleLineText: "text", multilineText: "longText", richText: "longText", email: "email", url: "url", phoneNumber: "phone",
  number: "number", currency: "currency", percent: "percent", checkbox: "checkbox", singleSelect: "select", multipleSelects: "multiSelect",
  date: "date", dateTime: "dateTime", rating: "rating", autoNumber: "autoNumber", createdTime: "createdTime", lastModifiedTime: "updatedTime",
  singleCollaborator: "user", createdBy: "user", lastModifiedBy: "user", multipleAttachments: "attachment", duration: "number", barcode: "text", aiText: "longText",
};

const NOTES: Record<string, string> = {
  richText: "Rich text becomes plain markdown text; images and @mentions inside it don't carry over.",
  duration: "Duration is stored as seconds (number).",
  barcode: "Barcode keeps the text; the barcode type is dropped.",
  aiText: "AI field becomes plain text with its current value. Regenerate with an Edge Function if needed.",
  createdBy: "Created by maps to a person by email. Invite people before the copy.",
  lastModifiedBy: "Last modified by maps to a person by email; it is not kept up to date after the copy.",
};

interface Ctx { base: AtBase; keys: Map<string, string>; tableKeys: Map<string, string>; fieldById: Map<string, { table: AtTable; field: AtField }>; dropped: Set<string>; notes: Note[] }

function selectOptions(f: AtField) {
  const choices = (f.options?.choices as { name: string; color?: string }[] | undefined) ?? [];
  return choices.map((c) => ({ value: c.name, color: chipColor(c.color) }));
}

function simpleField(ctx: Ctx, t: AtTable, f: AtField, key: string, type: FieldType): FieldDef {
  const def: FieldDef = { key, label: f.name, type, airtable: { id: f.id, type: f.type ?? "unknown" } };
  if (f.description) def.description = f.description;
  if (type === "select" || type === "multiSelect") def.options = selectOptions(f);
  if (typeof f.options?.precision === "number") def.precision = f.options.precision;
  if (type === "currency") def.currency = CURRENCY[String(f.options?.symbol ?? "$")] ?? "USD";
  if (type === "rating") def.max = Number(f.options?.max ?? 5);
  const note = NOTES[f.type ?? ""];
  if (note) ctx.notes.push({ table: t.name, field: f.name, level: "check", text: note });
  return def;
}

/** Of a link pair, keep one side: the single side holds the FK; for many-to-many, the first table seen. */
function keepLink(ctx: Ctx, t: AtTable, f: AtField): { keep: boolean; multiple: boolean } {
  const single = f.options?.prefersSingleRecordLink === true;
  const inverseId = f.options?.inverseLinkFieldId as string | undefined;
  const inverse = inverseId ? ctx.fieldById.get(inverseId) : undefined;
  if (!inverse || inverse.table.id === t.id && inverse.field.id === f.id) return { keep: true, multiple: !single };
  const otherSingle = inverse.field.options?.prefersSingleRecordLink === true;
  if (single !== otherSingle) return { keep: single, multiple: false };
  const order = ctx.base.tables.findIndex((x) => x.id === t.id) - ctx.base.tables.findIndex((x) => x.id === inverse.table.id);
  const first = order < 0 || (order === 0 && f.id < inverse.field.id);
  return { keep: first, multiple: !single };
}

function linkField(ctx: Ctx, t: AtTable, f: AtField, key: string): FieldDef | null {
  const target = ctx.tableKeys.get(String(f.options?.linkedTableId));
  if (!target) { ctx.notes.push({ table: t.name, field: f.name, level: "dropped", text: "Links to a table that is not migrated." }); return null; }
  const { keep, multiple } = keepLink(ctx, t, f);
  if (!keep) {
    ctx.dropped.add(f.id);
    ctx.notes.push({ table: t.name, field: f.name, level: "ok", text: `Other side of a link; shown as "Linked from" on the record page.` });
    return null;
  }
  ctx.notes.push({ table: t.name, field: f.name, level: multiple ? "ok" : "check", text: multiple ? `Many-to-many → junction table ${ctx.tableKeys.get(t.id)}_${key}_links.` : "One record per link → foreign key column. Check no record links to more than one (prefersSingleRecordLink is a hint, not enforced)." });
  return { key, label: f.name, type: "link", link: { table: target, multiple }, airtable: { id: f.id, type: "multipleRecordLinks" } };
}

function kindOf(type: FieldType): SqlKind {
  if (["number", "currency", "percent", "rating", "autoNumber"].includes(type)) return "number";
  if (type === "checkbox") return "bool";
  if (type === "date" || type === "dateTime") return "date";
  return ["text", "longText", "email", "url", "phone", "select"].includes(type) ? "text" : "other";
}

function formulaField(ctx: Ctx, t: AtTable, f: AtField, key: string, plain: Map<string, FieldType>): FieldDef {
  const raw = String(f.options?.formula ?? "");
  const expr = raw.replace(/\{(fld[A-Za-z0-9]+)\}/g, (_, id: string) => `{${ctx.keys.get(id) ?? id}}`);
  const def: FieldDef = { key, label: f.name, type: "formula", computed: { kind: "formula", expr, mode: "app" }, airtable: { id: f.id, type: "formula" } };
  if (f.options?.isValid === false) { ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: "Formula is marked invalid in Airtable." }); return def; }
  const r = formulaToSql(expr, (k) => { const ty = plain.get(k); return ty ? { column: k, kind: kindOf(ty) } : undefined; });
  if (r.ok) {
    def.computed = { kind: "formula", expr, mode: "generated" };
    ctx.notes.push({ table: t.name, field: f.name, level: "ok", text: "Formula → stored generated column." });
  } else {
    let parses = true;
    try { parseFormula(expr); } catch (e) { if (e instanceof FormulaError) parses = false; else throw e; }
    ctx.notes.push({ table: t.name, field: f.name, level: parses ? "check" : "rebuild", text: `Formula computed in the app: ${r.reason}.${parses ? "" : " Rebuild in TypeScript."}` });
  }
  return def;
}

function inverseKey(ctx: Ctx, linkId: string): { table: string; linkField: string } | null {
  const inverseId = ctx.fieldById.get(linkId)?.field.options?.inverseLinkFieldId as string | undefined;
  const inv = inverseId ? ctx.fieldById.get(inverseId) : undefined;
  if (!inv || ctx.dropped.has(inv.field.id)) return null;
  const table = ctx.tableKeys.get(inv.table.id), linkField = ctx.keys.get(inv.field.id);
  return table && linkField ? { table, linkField } : null;
}

function rollupField(ctx: Ctx, t: AtTable, f: AtField, key: string): FieldDef | null {
  const linkId = String(f.options?.recordLinkFieldId ?? "");
  const inv = inverseKey(ctx, linkId);
  if (!inv) { ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: "Rollup over a link this table holds itself; rebuild as a SQL view by hand." }); return null; }
  if (f.type === "count") {
    ctx.notes.push({ table: t.name, field: f.name, level: "ok", text: "Count → SQL view." });
    return { key, label: f.name, type: "rollup", computed: { kind: "rollup", table: inv.table, linkField: inv.linkField, fn: "count" }, airtable: { id: f.id, type: "count" } };
  }
  const src = ctx.keys.get(String(f.options?.fieldIdInLinkedTable ?? ""));
  const srcType = ctx.fieldById.get(String(f.options?.fieldIdInLinkedTable ?? ""))?.field.type ?? "";
  const fn: RollupFn = ["number", "currency", "percent", "duration", "rating"].includes(srcType) && src ? "sum" : "count";
  ctx.notes.push({ table: t.name, field: f.name, level: "check", text: `Airtable does not expose the rollup function. Guessed ${fn.toUpperCase()}; compare with Airtable's values before cutover.` });
  const def: FieldDef = { key, label: f.name, type: "rollup", computed: { kind: "rollup", table: inv.table, linkField: inv.linkField, fn, note: "Function guessed; confirm." }, airtable: { id: f.id, type: "rollup" } };
  if (fn !== "count" && src && def.computed?.kind === "rollup") def.computed.field = src;
  return def;
}

function lookupField(ctx: Ctx, t: AtTable, f: AtField, key: string): FieldDef | null {
  const via = ctx.keys.get(String(f.options?.recordLinkFieldId ?? ""));
  const field = ctx.keys.get(String(f.options?.fieldIdInLinkedTable ?? ""));
  if (!via || !field || ctx.dropped.has(String(f.options?.recordLinkFieldId))) {
    ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: "Lookup through the other side of a link; the record page shows those records under \"Linked from\"." });
    return null;
  }
  ctx.notes.push({ table: t.name, field: f.name, level: "ok", text: "Lookup → SQL view (lookup filters and sorts are not exposed; check if it had any)." });
  return { key, label: f.name, type: "lookup", computed: { kind: "lookup", via, field }, airtable: { id: f.id, type: "multipleLookupValues" } };
}

function mapField(ctx: Ctx, t: AtTable, f: AtField, plain: Map<string, FieldType>, pass: 1 | 2): FieldDef | null {
  const key = ctx.keys.get(f.id) as string;
  const type = f.type ?? "unknown";
  if (pass === 1) {
    if (SIMPLE[type]) return simpleField(ctx, t, f, key, SIMPLE[type] as FieldType);
    if (type === "multipleRecordLinks") return linkField(ctx, t, f, key);
    if (type === "button") { ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: "Button → rebuild as an action on the record page (keep its URL template)." }); return null; }
    if (type === "externalSyncSource") { ctx.notes.push({ table: t.name, field: f.name, level: "check", text: "Synced table marker. This table needs a new sync job or a one-off copy." }); return null; }
    if (type === "multipleCollaborators") { ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: "Several people per cell → kept as raw JSON; make a junction table to profiles if it matters." }); return { key, label: f.name, type: "json", airtable: { id: f.id, type } }; }
    if (["formula", "rollup", "count", "multipleLookupValues"].includes(type)) return null;
    ctx.notes.push({ table: t.name, field: f.name, level: "rebuild", text: `Unknown Airtable type "${type}" → raw JSON column.` });
    return { key, label: f.name, type: "json", airtable: { id: f.id, type } };
  }
  if (type === "formula") return formulaField(ctx, t, f, key, plain);
  if (type === "rollup" || type === "count") return rollupField(ctx, t, f, key);
  if (type === "multipleLookupValues") return lookupField(ctx, t, f, key);
  return null;
}

function mapViews(ctx: Ctx, t: AtTable, fields: FieldDef[]): { views: ViewDef[]; forms: FormDef[] } {
  const byId = new Map(fields.map((f) => [f.airtable?.id, f.key]));
  const views: ViewDef[] = [];
  const forms: FormDef[] = [];
  const taken = new Set<string>();
  const firstOf = (types: FieldType[]) => fields.find((f) => types.includes(f.type))?.key;
  for (const v of t.views) {
    if (v.personalForUserId) { ctx.notes.push({ table: t.name, field: `view ${v.name}`, level: "dropped", text: "Personal view; recreate it if its owner still needs it." }); continue; }
    const key = toKey(v.name, taken);
    if (v.type === "form") {
      forms.push({ key: `${ctx.tableKeys.get(t.id)}_${key}`.slice(0, 50), label: v.name, table: ctx.tableKeys.get(t.id) as string, fields: fields.filter((f) => ["text", "longText", "email", "phone", "url", "number", "currency", "select", "date", "checkbox"].includes(f.type)).map((f) => f.key) });
      ctx.notes.push({ table: t.name, field: `view ${v.name}`, level: "check", text: "Form view: the API gives no field list. Draft uses all simple fields; match the real form and keep its public URL working at cutover." });
      continue;
    }
    const base: ViewDef = { key, label: v.name, type: "grid", airtable: { id: v.id, type: v.type } };
    if (v.type === "grid" && v.visibleFieldIds) base.columns = v.visibleFieldIds.map((id) => byId.get(id)).filter((k): k is string => Boolean(k)).slice(0, 12);
    if (v.type === "kanban") { const by = firstOf(["select"]); if (by) { base.type = "kanban"; base.by = by; } }
    if (v.type === "calendar") { const by = firstOf(["date", "dateTime"]); if (by) { base.type = "calendar"; base.by = by; } }
    if (!["grid", "kanban", "calendar"].includes(v.type)) ctx.notes.push({ table: t.name, field: `view ${v.name}`, level: "check", text: `${v.type} view → grid for now.` });
    ctx.notes.push({ table: t.name, field: `view ${v.name}`, level: "check", text: "Filters, sorts and grouping are not in the API. Add them from a screenshot or the owner." + (v.type === "kanban" || v.type === "calendar" ? " The grouping/date field is a guess." : "") });
    views.push(base);
  }
  if (!views.length) views.push({ key: "all", label: `All ${t.name.toLowerCase()}`, type: "grid" });
  return { views, forms };
}

function dashboard(tables: TableDef[]): DashboardDef {
  return {
    key: "overview",
    label: "Overview",
    tiles: tables.slice(0, 6).map((t) => ({ label: t.label, table: t.key, metric: "count" as const })),
    charts: tables.flatMap((t) => { const s = t.fields.find((f) => f.type === "select"); return s ? [{ label: `${t.label} by ${s.label.toLowerCase()}`, table: t.key, groupBy: s.key, metric: "count" as const }] : []; }).slice(0, 4),
  };
}

export function draftFromBase(base: AtBase, appName = base.name): Draft {
  const ctx: Ctx = { base, keys: new Map(), tableKeys: new Map(), fieldById: new Map(), dropped: new Set(), notes: [] };
  const tables = base.tables.filter((t) => t.migrate !== false);
  for (const t of base.tables.filter((x) => x.migrate === false)) ctx.notes.push({ table: t.name, level: "dropped", text: "Marked do-not-migrate in the plan." });
  const tableTaken = new Set<string>();
  for (const t of tables) {
    ctx.tableKeys.set(t.id, toKey(t.name, tableTaken, RESERVED_TABLES));
    const fieldTaken = new Set<string>();
    for (const f of t.fields) { ctx.keys.set(f.id, toKey(f.name, fieldTaken, SYSTEM_COLUMNS)); ctx.fieldById.set(f.id, { table: t, field: f }); }
  }
  // Pass 1: plain fields and links (decides which link sides survive). Pass 2: formulas, lookups, rollups.
  const pass1 = new Map<string, FieldDef[]>();
  for (const t of tables) {
    const kept = t.fields.filter((f) => f.migrate !== false);
    for (const f of t.fields.filter((x) => x.migrate === false)) ctx.notes.push({ table: t.name, field: f.name, level: "dropped", text: "Marked do-not-migrate (low fill / unused)." });
    pass1.set(t.id, kept.map((f) => mapField(ctx, t, f, new Map(), 1)).filter((x): x is FieldDef => x !== null));
  }
  const out: TableDef[] = tables.map((t) => {
    const plain = new Map((pass1.get(t.id) ?? []).filter((f) => !["link", "attachment", "user", "json"].includes(f.type)).map((f) => [f.key, f.type]));
    const second = t.fields.filter((f) => f.migrate !== false).map((f) => mapField(ctx, t, f, plain, 2)).filter((x): x is FieldDef => x !== null);
    const order = new Map(t.fields.map((f, i) => [f.id, i]));
    const fields = [...(pass1.get(t.id) ?? []), ...second].sort((a, b) => (order.get(a.airtable?.id ?? "") ?? 0) - (order.get(b.airtable?.id ?? "") ?? 0));
    const primary = ctx.keys.get(t.primaryFieldId) ?? fields[0]?.key ?? "name";
    const def: TableDef = { key: ctx.tableKeys.get(t.id) as string, label: t.name, primaryField: primary, fields, views: [], airtable: { id: t.id } };
    if (t.description) def.description = t.description;
    return def;
  });
  const forms: FormDef[] = [];
  for (const [i, t] of tables.entries()) {
    const def = out[i] as TableDef;
    const r = mapViews(ctx, t, def.fields);
    def.views = r.views;
    forms.push(...r.forms);
    if (!def.fields.some((f) => f.key === def.primaryField)) {
      def.fields.unshift({ key: def.primaryField, label: "Name", type: "text" });
      ctx.notes.push({ table: t.name, level: "rebuild", text: "Primary field was a computed field that could not be kept; added a plain Name column. Fill it in the migration." });
    }
  }
  const hasPortal = (base.interfaces ?? []).some((i) => (i.collaborators ?? []).some((c) => c.permissionLevel === "interfaceOnly" || c.permissionLevel === "read"));
  const roles: AppSchema["roles"] = [
    { key: "admin", label: "Admin", read: "*", write: "*" },
    { key: "editor", label: "Editor", read: "*", write: "*" },
    { key: "viewer", label: "Viewer", read: "*", write: [] },
  ];
  if (hasPortal) {
    roles.push({ key: "portal", label: "Outside user", read: [], write: [] });
    ctx.notes.push({ table: "(roles)", level: "check", text: "Interfaces have interface-only users. A portal role was added with no access; give it the tables its pages need (roles-and-access skill)." });
  }
  return { schema: { $schema: "./schema/app.schema.v1.json", version: 1, app: { name: appName, currency: "USD", locale: "en-US", timeZone: "UTC" }, tables: out, dashboards: [dashboard(out)], forms, roles }, notes: ctx.notes };
}

export function notesMarkdown(d: Draft): string {
  const label: Record<NoteLevel, string> = { ok: "ok", check: "check", rebuild: "rebuild", dropped: "dropped" };
  const lines = ["| Table | Field / view | Result | Note |", "|---|---|---|---|"];
  for (const n of d.notes) lines.push(`| ${n.table} | ${n.field ?? ""} | ${label[n.level]} | ${n.text.replace(/\|/g, "\\|")} |`);
  const count = (l: NoteLevel) => d.notes.filter((n) => n.level === l).length;
  return `Summary: ${d.schema.tables.length} tables, ${d.schema.tables.reduce((a, t) => a + t.fields.length, 0)} fields kept; ${count("check")} to check, ${count("rebuild")} to rebuild, ${count("dropped")} dropped.\n\n${lines.join("\n")}\n`;
}
