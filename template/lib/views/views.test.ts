import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AppSchema, TableDef, ViewDef } from "../schema/types.ts";
import type { Person, Row } from "../data/types.ts";
import { cellText, formatCell, initials } from "./format.ts";
import { hrefWith, queryFromParams } from "./url.ts";
import { toGridView } from "./grid-view.ts";
import { toCalendarView, toKanbanView } from "./board-views.ts";
import { chartVM, tileVM } from "./dashboard-view.ts";
import { incomingLinks, sizeText, toRecordView } from "./record-view.ts";

const schema: AppSchema = JSON.parse(readFileSync(new URL("../../app.schema.json", import.meta.url), "utf8"));
const table = (k: string) => schema.tables.find((t) => t.key === k) as TableDef;
const view = (t: string, v: string) => table(t).views.find((x) => x.key === v) as ViewDef;
const field = (t: string, f: string) => table(t).fields.find((x) => x.key === f)!;
const people: Person[] = [{ id: "u1", name: "Maya Chen", email: "maya@example.com", role: "admin" }];
const ctx = { labels: { companies: { c1: "Northwind" } }, people: new Map(people.map((p) => [p.id, p])), currency: "USD", locale: "en-US" };

test("cells: currency, percent, select color, link labels, user initials, empty", () => {
  assert.equal(cellText(formatCell(field("deals", "value"), 12500, ctx)), "$12,500");
  assert.equal(cellText(formatCell(field("deals", "probability"), 0.25, ctx)), "25%");
  assert.deepEqual(formatCell(field("deals", "stage"), "Won", ctx), { kind: "chips", chips: [{ label: "Won", color: "green" }] });
  assert.deepEqual(formatCell(field("deals", "company"), "c1", ctx), { kind: "records", items: [{ id: "c1", label: "Northwind", href: "/t/companies/r/c1" }] });
  assert.deepEqual(formatCell(field("deals", "owner"), "u1", ctx), { kind: "user", name: "Maya Chen", initials: "MC" });
  assert.equal(formatCell(field("deals", "close_date"), null, ctx).kind, "empty");
  assert.equal(cellText(formatCell(field("deals", "close_date"), "2026-11-08", ctx)), "Nov 8, 2026");
  assert.equal(initials("prince"), "P");
});

test("url: view filters stay, URL filters add, URL sort replaces, page resets on change", () => {
  const q = queryFromParams(view("deals", "won"), { f: "value:gt:1000", s: "value:desc", p: "3", q: "web" });
  assert.deepEqual(q.filters, [{ field: "stage", op: "eq", value: "Won" }, { field: "value", op: "gt", value: "1000" }]);
  assert.deepEqual(q.sorts, [{ field: "value", dir: "desc" }]);
  assert.equal(q.page, 3);
  assert.equal(q.search, "web");
  assert.equal(hrefWith("/t/deals/v/won", { p: "3", q: "web" }, { s: "name:asc" }), "/t/deals/v/won?q=web&s=name%3Aasc");
  assert.equal(queryFromParams(view("deals", "won"), { p: "-4" }).page, 1);
});

test("grid: columns, sort links, inline-edit flags and pager text", () => {
  const rows: Row[] = [{ id: "d1", name: "Portal", company: "c1", stage: "Won", value: 5000, owner: "u1" }];
  const vm = toGridView({
    schema, table: table("deals"), view: view("deals", "all"),
    page: { rows, total: 120, page: 2, pageSize: 50, notices: [] },
    query: queryFromParams(view("deals", "all"), { p: "2" }),
    labels: ctx.labels, people, canWrite: true, base: "/t/deals/v/all", params: { p: "2" },
  });
  assert.deepEqual(vm.columns.map((c) => c.key), ["name", "company", "stage", "value", "probability", "weighted_value", "close_date", "owner", "source"]);
  const close = vm.columns.find((c) => c.key === "close_date")!;
  assert.equal(close.sort, "desc");
  assert.equal(close.sortHref, "/t/deals/v/all?s=close_date%3Aasc");
  assert.equal(vm.columns.find((c) => c.key === "company")?.editable, false, "links open the record");
  assert.equal(vm.columns.find((c) => c.key === "weighted_value")?.editable, false, "formulas are read-only");
  assert.equal(vm.columns.find((c) => c.key === "value")?.align, "right");
  assert.deepEqual([vm.pager.from, vm.pager.to, vm.pager.pages], [51, 100, 3]);
  assert.equal(vm.pager.prevHref, "/t/deals/v/all?p=1");
  assert.equal(vm.rows[0]?.href, "/t/deals/r/d1");
  assert.equal(vm.filters.length, 0);
});

test("grid: viewers can't edit", () => {
  const vm = toGridView({
    schema, table: table("deals"), view: view("deals", "all"), page: { rows: [], total: 0, page: 1, pageSize: 50, notices: [] },
    query: queryFromParams(view("deals", "all"), {}), labels: {}, people, canWrite: false, base: "/x", params: {},
  });
  assert.ok(vm.columns.every((c) => !c.editable));
  assert.deepEqual([vm.pager.from, vm.pager.to], [0, 0]);
});

test("kanban: one column per option in schema order, empty bucket only when used", () => {
  const rows: Row[] = [
    { id: "1", name: "A", stage: "Won", value: 1 },
    { id: "2", name: "B", stage: "Lead" },
    { id: "3", name: "C", stage: null },
  ];
  const vm = toKanbanView(schema, table("deals"), view("deals", "pipeline"), rows, {}, people);
  assert.deepEqual(vm.columns.map((c) => [c.label, c.count]), [["Lead", 1], ["Qualified", 0], ["Proposal", 0], ["Negotiation", 0], ["Won", 1], ["Lost", 0], ["No stage", 1]]);
  assert.equal(vm.columns[4]?.cards[0]?.meta[0]?.label, "Value");
});

test("calendar: Monday-first month grid with items on their day", () => {
  const rows: Row[] = [{ id: "t1", title: "Kickoff", due: "2026-11-12", status: "To do" }];
  const vm = toCalendarView(schema, table("tasks"), view("tasks", "calendar"), rows, "2026-11", new Date("2026-11-08T09:00:00Z"));
  assert.equal(vm.title, "November 2026");
  assert.equal(vm.weeks[0]?.[0]?.date, "2026-10-26");
  const day = vm.weeks.flat().find((d) => d.date === "2026-11-12");
  assert.equal(day?.items[0]?.title, "Kickoff");
  assert.equal(vm.weeks.flat().find((d) => d.isToday)?.date, "2026-11-08");
  assert.deepEqual([vm.prevMonth, vm.nextMonth], ["2026-10", "2026-12"]);
});

test("dashboard: tiles with filters, charts keep select order", () => {
  const rows = { deals: [
    { id: "1", stage: "Won", value: 1000 }, { id: "2", stage: "Lead", value: 500 }, { id: "3", stage: "Lost", value: 9 }, { id: "4", stage: "Proposal", value: null },
  ] as Row[] };
  const open = tileVM(schema, schema.dashboards[0]!.tiles[1]!, rows);
  assert.deepEqual([open.label, open.value, open.sub], ["Open pipeline", "$500", "2 deals"]);
  const chart = chartVM(schema, schema.dashboards[0]!.charts[0]!, rows);
  assert.deepEqual(chart.bars.map((b) => b.label), ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"]);
  assert.equal(chart.bars.find((b) => b.label === "Won")?.pct, 100);
  assert.equal(chart.total, "$1,509");
});

test("record: incoming links, read-only computed fields with a note, file sizes", () => {
  assert.deepEqual(incomingLinks(schema, table("companies")).map((x) => `${x.table.key}.${x.field.key}`), ["contacts.company", "deals.company", "tasks.company"]);
  const vm = toRecordView({
    schema, table: table("deals"), row: { id: "d1", name: "Portal", weighted_value: 10, stage: "Won" }, labels: {}, people, canWrite: true,
    backlinks: [], files: [{ id: "f", field: "files", filename: "a.pdf", size: 2048 }], comments: [],
    activity: [{ id: "a", actor: "Maya", action: "update", field: "stage", newValue: "Won", createdAt: "2026-11-08T10:00:00Z" }],
  });
  assert.equal(vm.title, "Portal");
  const w = vm.fields.find((f) => f.key === "weighted_value")!;
  assert.equal(w.editable, false);
  assert.equal(w.computedNote, "Formula: {value} * {probability}");
  assert.equal(vm.files[0]?.sizeText, "2 KB");
  assert.equal(vm.activity[0]?.text, "changed Stage to Won");
  assert.equal(sizeText(3 * 1024 * 1024), "3.0 MB");
});

import { parseInput } from "./parse-input.ts";

test("input parsing: numbers, percent, options, email, required, computed", () => {
  assert.deepEqual(parseInput(field("deals", "value"), "$12,500"), { ok: true, value: 12500 });
  assert.deepEqual(parseInput(field("deals", "probability"), "25"), { ok: true, value: 0.25 });
  assert.deepEqual(parseInput(field("deals", "probability"), "0.5"), { ok: true, value: 0.5 });
  assert.deepEqual(parseInput(field("deals", "stage"), "Won"), { ok: true, value: "Won" });
  assert.equal(parseInput(field("deals", "stage"), "Maybe").ok, false);
  assert.deepEqual(parseInput(field("contacts", "email"), " Ana@Example.com "), { ok: true, value: "ana@example.com" });
  assert.equal(parseInput(field("contacts", "email"), "nope").ok, false);
  assert.deepEqual(parseInput(field("deals", "name"), ""), { ok: false, error: "Deal is required" });
  assert.deepEqual(parseInput(field("deals", "close_date"), ""), { ok: true, value: null });
  assert.equal(parseInput(field("deals", "weighted_value"), "1").ok, false);
  assert.deepEqual(parseInput(field("deals", "contacts"), ["a", "b", "a"]), { ok: true, value: ["a", "b"] });
  assert.deepEqual(parseInput(field("companies", "website"), "example.com"), { ok: true, value: "https://example.com" });
});

import { collectValues, formFields } from "./forms.ts";

test("forms: collect typed values and per-field errors", () => {
  const fd = new FormData();
  fd.set("name", "New site");
  fd.set("value", "4,000");
  fd.set("stage", "Bogus");
  const fields = formFields(table("deals"), schema.forms.find((f) => f.key === "new_deal"));
  const r = collectValues(fields, fd);
  assert.equal(r.values.name, "New site");
  assert.equal(r.values.value, 4000);
  assert.equal(r.values.close_date, null);
  assert.deepEqual(r.errors, { stage: '"Bogus" is not an option for Stage' });
  assert.ok(formFields(table("deals")).every((f) => f.type !== "formula"));
});
