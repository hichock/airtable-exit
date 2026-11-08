// Validates app.schema.json before the app renders it or SQL is generated from it.
// Errors stop the build of pages/SQL; warnings go into the report and kb.

import { parseFormula, refsOf, FormulaError } from "../formula/parse.ts";
import { KEY_PATTERN, RESERVED_TABLES, SYSTEM_COLUMNS, findField, findTable } from "./naming.ts";
import type { AppSchema, FieldDef, FieldType, Filter, TableDef, ViewDef } from "./types.ts";
import { isEditable } from "./types.ts";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  schema?: AppSchema;
}

const FIELD_TYPES: FieldType[] = [
  "text", "longText", "email", "url", "phone", "number", "currency", "percent", "checkbox", "select",
  "multiSelect", "date", "dateTime", "rating", "link", "attachment", "user", "formula", "lookup", "rollup",
  "autoNumber", "createdTime", "updatedTime", "json",
];
const NUMERIC: FieldType[] = ["number", "currency", "percent", "rating", "autoNumber", "formula", "rollup"];
const OPS = ["eq", "neq", "contains", "gt", "gte", "lt", "lte", "empty", "notEmpty", "in"];

type Report = { errors: string[]; warnings: string[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkStructure(input: unknown, r: Report): input is AppSchema {
  if (!isObj(input)) { r.errors.push("schema: must be a JSON object"); return false; }
  if (input.version !== 1) r.errors.push("version: must be 1");
  if (!isObj(input.app) || typeof input.app.name !== "string") r.errors.push("app.name: required");
  for (const k of ["tables", "dashboards", "forms", "roles"]) {
    if (!Array.isArray(input[k])) r.errors.push(`${k}: must be an array`);
  }
  if (Array.isArray(input.tables) && input.tables.length === 0) r.errors.push("tables: add at least one table");
  return r.errors.length === 0;
}

function checkUnique(keys: string[], where: string, r: Report): void {
  const seen = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) r.errors.push(`${where}: duplicate key "${k}"`);
    seen.add(k);
  }
}

function checkKey(key: unknown, where: string, r: Report): void {
  if (typeof key !== "string" || !KEY_PATTERN.test(key)) {
    r.errors.push(`${where}: key "${String(key)}" must be snake_case (a-z, 0-9, _), max 51 chars`);
  }
}

function checkFormula(t: TableDef, f: FieldDef, where: string, r: Report): void {
  if (f.computed?.kind !== "formula") { r.errors.push(`${where}: formula fields need computed.kind "formula"`); return; }
  try {
    for (const ref of refsOf(parseFormula(f.computed.expr))) {
      if (!findField(t, ref)) r.errors.push(`${where}: formula reads unknown field {${ref}}`);
    }
  } catch (e) {
    if (e instanceof FormulaError) r.errors.push(`${where}: formula does not parse (${e.message})`);
    else throw e;
  }
}

function checkLookup(s: AppSchema, t: TableDef, f: FieldDef, where: string, r: Report): void {
  if (f.computed?.kind !== "lookup") { r.errors.push(`${where}: lookup fields need computed.kind "lookup"`); return; }
  const via = findField(t, f.computed.via);
  if (via?.type !== "link" || !via.link) { r.errors.push(`${where}: lookup.via must be a link field of ${t.key}`); return; }
  const target = findTable(s.tables, via.link.table);
  if (target && !findField(target, f.computed.field)) r.errors.push(`${where}: ${via.link.table} has no field "${f.computed.field}"`);
}

function checkRollup(s: AppSchema, t: TableDef, f: FieldDef, where: string, r: Report): void {
  const c = f.computed;
  if (c?.kind !== "rollup") { r.errors.push(`${where}: rollup fields need computed.kind "rollup"`); return; }
  const src = findTable(s.tables, c.table);
  if (!src) { r.errors.push(`${where}: rollup table "${c.table}" does not exist`); return; }
  const link = findField(src, c.linkField);
  if (link?.type !== "link" || link.link?.table !== t.key) r.errors.push(`${where}: ${c.table}.${c.linkField} must link to ${t.key}`);
  if (c.fn !== "count" && (!c.field || !findField(src, c.field))) r.errors.push(`${where}: rollup ${c.fn} needs a field of ${c.table}`);
}

function checkField(s: AppSchema, t: TableDef, f: FieldDef, r: Report): void {
  const where = `tables.${t.key}.fields.${f.key}`;
  checkKey(f.key, where, r);
  if ((SYSTEM_COLUMNS as readonly string[]).includes(f.key)) r.errors.push(`${where}: "${f.key}" is a system column name`);
  if (!FIELD_TYPES.includes(f.type)) { r.errors.push(`${where}: unknown type "${String(f.type)}"`); return; }
  if (typeof f.label !== "string" || !f.label) r.errors.push(`${where}: label required`);
  if ((f.type === "select" || f.type === "multiSelect") && !f.options?.length) r.errors.push(`${where}: select fields need options`);
  if (f.type === "link") {
    if (!f.link || !findTable(s.tables, f.link.table)) r.errors.push(`${where}: link.table must name an existing table`);
  }
  if (f.type === "formula") checkFormula(t, f, where, r);
  if (f.type === "lookup") checkLookup(s, t, f, where, r);
  if (f.type === "rollup") checkRollup(s, t, f, where, r);
}

function checkFilters(t: TableDef, filters: Filter[] | undefined, where: string, r: Report): void {
  for (const flt of filters ?? []) {
    if (!findField(t, flt.field)) r.errors.push(`${where}: filter on unknown field "${flt.field}"`);
    if (!OPS.includes(flt.op)) r.errors.push(`${where}: unknown filter op "${flt.op}"`);
  }
}

function isAppComputed(f: FieldDef | undefined): boolean {
  if (!f) return false;
  if (f.type === "lookup" || f.type === "rollup") return true;
  return f.computed?.kind === "formula" && f.computed.mode === "app";
}

function checkView(t: TableDef, v: ViewDef, r: Report): void {
  const where = `tables.${t.key}.views.${v.key}`;
  checkKey(v.key, where, r);
  for (const c of v.columns ?? []) if (!findField(t, c)) r.errors.push(`${where}: column "${c}" does not exist`);
  for (const c of v.cardFields ?? []) if (!findField(t, c)) r.errors.push(`${where}: card field "${c}" does not exist`);
  checkFilters(t, v.filters, where, r);
  for (const so of v.sorts ?? []) {
    const f = findField(t, so.field);
    if (!f) r.errors.push(`${where}: sort on unknown field "${so.field}"`);
    if (isAppComputed(f)) r.warnings.push(`${where}: sorting by computed "${so.field}" happens per page only`);
  }
  if (v.type === "kanban" && findField(t, v.by ?? "")?.type !== "select") r.errors.push(`${where}: kanban "by" must be a select field`);
  if (v.type === "calendar" && !["date", "dateTime"].includes(findField(t, v.by ?? "")?.type ?? "")) {
    r.errors.push(`${where}: calendar "by" must be a date field`);
  }
}

function checkTable(s: AppSchema, t: TableDef, r: Report): void {
  const where = `tables.${t.key}`;
  checkKey(t.key, where, r);
  if ((RESERVED_TABLES as readonly string[]).includes(t.key)) r.errors.push(`${where}: "${t.key}" is a reserved table name`);
  if (!Array.isArray(t.fields) || !Array.isArray(t.views)) { r.errors.push(`${where}: fields and views must be arrays`); return; }
  checkUnique(t.fields.map((f) => f.key), `${where}.fields`, r);
  checkUnique(t.views.map((v) => v.key), `${where}.views`, r);
  if (!findField(t, t.primaryField)) r.errors.push(`${where}: primaryField "${t.primaryField}" does not exist`);
  if (t.views.length === 0) r.errors.push(`${where}: add at least one view`);
  for (const f of t.fields) checkField(s, t, f, r);
  for (const v of t.views) checkView(t, v, r);
}

function checkForms(s: AppSchema, r: Report): void {
  checkUnique(s.forms.map((f) => f.key), "forms", r);
  for (const form of s.forms) {
    const where = `forms.${form.key}`;
    checkKey(form.key, where, r);
    const t = findTable(s.tables, form.table);
    if (!t) { r.errors.push(`${where}: table "${form.table}" does not exist`); continue; }
    for (const k of form.fields) {
      const f = findField(t, k);
      if (!f) r.errors.push(`${where}: field "${k}" does not exist`);
      else if (!isEditable(f)) r.errors.push(`${where}: field "${k}" (${f.type}) cannot be typed into`);
    }
    if (form.public && form.fields.some((k) => findField(t, k)?.type === "link")) {
      r.warnings.push(`${where}: public form with a link field shows every record of the linked table`);
    }
  }
}

function checkDashboards(s: AppSchema, r: Report): void {
  checkUnique(s.dashboards.map((d) => d.key), "dashboards", r);
  for (const d of s.dashboards) {
    const items = [...d.tiles.map((x) => ({ ...x, kind: "tile" })), ...d.charts.map((x) => ({ ...x, kind: "chart" }))];
    for (const it of items) {
      const where = `dashboards.${d.key}.${it.kind} "${it.label}"`;
      const t = findTable(s.tables, it.table);
      if (!t) { r.errors.push(`${where}: table "${it.table}" does not exist`); continue; }
      if (it.metric !== "count") {
        const f = findField(t, it.field ?? "");
        if (!f || !NUMERIC.includes(f.type)) r.errors.push(`${where}: ${it.metric} needs a number field`);
      }
      if ("groupBy" in it && !findField(t, String(it.groupBy))) r.errors.push(`${where}: groupBy field does not exist`);
      checkFilters(t, it.filters, where, r);
    }
  }
}

function checkRoles(s: AppSchema, r: Report): void {
  checkUnique(s.roles.map((x) => x.key), "roles", r);
  if (!s.roles.some((x) => x.key === "admin")) r.errors.push("roles: an \"admin\" role is required");
  for (const role of s.roles) {
    for (const access of [role.read, role.write]) {
      if (access === "*") continue;
      for (const k of access) if (!findTable(s.tables, k)) r.errors.push(`roles.${role.key}: table "${k}" does not exist`);
    }
  }
}

export function validateSchema(input: unknown): ValidationResult {
  const r: Report = { errors: [], warnings: [] };
  if (!checkStructure(input, r)) return { ok: false, ...r };
  const s = input;
  checkUnique(s.tables.map((t) => t.key), "tables", r);
  for (const t of s.tables) checkTable(s, t, r);
  checkForms(s, r);
  checkDashboards(s, r);
  checkRoles(s, r);
  return r.errors.length ? { ok: false, ...r } : { ok: true, ...r, schema: s };
}
