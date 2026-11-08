// Page loaders: read only, throw "Could not load …" on failure. Pages call one loader, one view model.

import type { Session } from "./session.ts";
import { can } from "./session.ts";
import { linkLabels, withComputed, type Labels } from "./data/computed.ts";
import type { Person, Row } from "./data/types.ts";
import type { DashboardDef, Filter, FormDef, TableDef, ViewDef } from "./schema/types.ts";
import { findTable } from "./schema/naming.ts";
import { queryFromParams, type Params } from "./views/url.ts";
import { toGridView, type GridView } from "./views/grid-view.ts";
import { toKanbanView, toCalendarView, monthRange, parseMonth, type KanbanView, type CalendarView } from "./views/board-views.ts";
import { incomingLinks, toRecordView, type RecordVM } from "./views/record-view.ts";
import { tablesOf, toDashboardView, type DashboardVM } from "./views/dashboard-view.ts";
import { formFields } from "./views/forms.ts";
import { toFormFields, type FormFieldVM } from "./views/form-fields.ts";

export const LINK_CHOICE_CAP = 500;

export type ViewData =
  | { type: "grid"; vm: GridView; people: Person[] }
  | { type: "kanban"; vm: KanbanView }
  | { type: "calendar"; vm: CalendarView };

async function loadGrid(s: Session, t: TableDef, v: ViewDef, params: Params, base: string): Promise<ViewData> {
  const query = queryFromParams(v, params);
  const page = await s.store.list(t, query);
  await withComputed(s.schema, t, page.rows, s.store);
  const [labels, people] = await Promise.all([linkLabels(s.schema, t, page.rows, s.store), s.store.people()]);
  return { type: "grid", people, vm: toGridView({ schema: s.schema, table: t, view: v, page, query, labels, people, canWrite: can(s, t.key, "write"), base, params }) };
}

async function rowsWithLabels(s: Session, t: TableDef, filters: Filter[]): Promise<{ rows: Row[]; labels: Labels; people: Person[] }> {
  const rows = await s.store.all(t, filters);
  await withComputed(s.schema, t, rows, s.store);
  const [labels, people] = await Promise.all([linkLabels(s.schema, t, rows, s.store), s.store.people()]);
  return { rows, labels, people };
}

export async function loadView(s: Session, t: TableDef, v: ViewDef, params: Params, base: string): Promise<ViewData> {
  if (v.type === "grid") return loadGrid(s, t, v, params, base);
  const query = queryFromParams(v, params);
  if (v.type === "kanban") {
    const { rows, labels, people } = await rowsWithLabels(s, t, query.filters);
    return { type: "kanban", vm: toKanbanView(s.schema, t, v, rows, labels, people) };
  }
  const now = new Date();
  const month = parseMonth(typeof params.m === "string" ? params.m : undefined, now);
  const { start, end } = monthRange(month);
  // Widen by a week either side so the grid's leading and trailing days show their items.
  const from = new Date(Date.parse(start) - 7 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(end) + 7 * 86_400_000).toISOString().slice(0, 10);
  const by = v.by ?? "";
  const { rows } = await rowsWithLabels(s, t, [...query.filters, { field: by, op: "gte", value: from }, { field: by, op: "lte", value: to }]);
  return { type: "calendar", vm: toCalendarView(s.schema, t, v, rows, month, now) };
}

export interface RecordData {
  vm: RecordVM;
  people: Person[];
  linkChoices: Record<string, { value: string; label: string }[]>;
  notices: string[];
  canWrite: boolean;
}

async function linkChoices(s: Session, t: TableDef): Promise<{ choices: RecordData["linkChoices"]; notices: string[] }> {
  const choices: RecordData["linkChoices"] = {};
  const notices: string[] = [];
  for (const f of t.fields) {
    const target = f.type === "link" && f.link ? findTable(s.schema.tables, f.link.table) : undefined;
    if (!target || !f.link) continue;
    const page = await s.store.list(target, { filters: [], sorts: [{ field: target.primaryField, dir: "asc" }], page: 1, pageSize: LINK_CHOICE_CAP });
    choices[f.key] = page.rows.map((r) => ({ value: r.id, label: String(r[target.primaryField] ?? "Untitled") }));
    if (page.total > LINK_CHOICE_CAP) notices.push(`${f.label}: the picker shows the first ${LINK_CHOICE_CAP} of ${page.total} ${target.label.toLowerCase()}.`);
  }
  return { choices, notices };
}

export async function loadRecord(s: Session, t: TableDef, id: string): Promise<RecordData | null> {
  const row = await s.store.get(t, id);
  if (!row) return null;
  await withComputed(s.schema, t, [row], s.store);
  const incoming = incomingLinks(s.schema, t).filter((x) => can(s, x.table.key, "read"));
  const [labels, people, files, comments, activity, links, backlinks] = await Promise.all([
    linkLabels(s.schema, t, [row], s.store),
    s.store.people(),
    s.store.attachments(t, id),
    s.store.comments(t, id),
    s.store.activity(t, id),
    linkChoices(s, t),
    Promise.all(incoming.map(async (x) => ({ ...x, rows: await s.store.linking(x.table, x.field, [id]) }))),
  ]);
  const canWrite = can(s, t.key, "write");
  const vm = toRecordView({ schema: s.schema, table: t, row, labels, people, canWrite, backlinks, files, comments, activity });
  return { vm, people, linkChoices: links.choices, notices: links.notices, canWrite };
}

/** Tiles and charts on tables this person can't read are left out, not shown as 0. */
export async function loadDashboard(s: Session, d: DashboardDef): Promise<DashboardVM> {
  const readable = (key: string) => can(s, key, "read");
  const visible: DashboardDef = { ...d, tiles: d.tiles.filter((x) => readable(x.table)), charts: d.charts.filter((x) => readable(x.table)) };
  const rows: Record<string, Row[]> = {};
  for (const key of tablesOf(visible)) {
    const t = findTable(s.schema.tables, key);
    if (t) rows[key] = await withComputed(s.schema, t, await s.store.all(t, []), s.store);
  }
  return toDashboardView(s.schema, visible, rows);
}

export interface FormFieldsData {
  fields: FormFieldVM[];
  notices: string[];
}

/** Fields for a create form, with choices for selects, people and links. */
export async function loadFormFields(s: Session, t: TableDef, form?: FormDef, withPeople = true): Promise<FormFieldsData> {
  const fields = formFields(t, form);
  const [links, people] = await Promise.all([linkChoices(s, t), withPeople ? s.store.people() : Promise.resolve([])]);
  return { fields: toFormFields(fields, people, links.choices), notices: links.notices };
}
