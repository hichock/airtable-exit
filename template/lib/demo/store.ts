// In-memory store for DEMO mode. Data lives in this server process and resets on restart.

import type { Filter, FieldDef, TableDef } from "../schema/types.ts";
import { applyQuery, matchFilter } from "../data/query.ts";
import { idsOf } from "../data/computed.ts";
import type { Actor, Page, Query, Row, Store } from "../data/types.ts";
import { buildSeed, type DemoData } from "./seed.ts";

const g = globalThis as unknown as { __airtableExitDemo?: DemoData };

function db(): DemoData {
  return (g.__airtableExitDemo ??= buildSeed());
}

function rowsOf(t: TableDef): Row[] {
  return (db().tables[t.key] ??= []);
}

const k = (t: TableDef, id: string) => `${t.key}:${id}`;

export function resetDemo(now?: Date): void {
  g.__airtableExitDemo = buildSeed(now);
}

export const demoStore: Store = {
  mode: "demo",

  async list(t: TableDef, q: Query): Promise<Page> {
    return applyQuery(rowsOf(t).map((r) => ({ ...r })), t, q);
  },

  async all(t: TableDef, filters: Filter[]): Promise<Row[]> {
    return rowsOf(t).filter((r) => filters.every((f) => matchFilter(r, f))).map((r) => ({ ...r }));
  },

  async get(t: TableDef, id: string): Promise<Row | null> {
    const r = rowsOf(t).find((x) => x.id === id);
    return r ? { ...r } : null;
  },

  async byIds(t: TableDef, ids: string[]): Promise<Row[]> {
    const set = new Set(ids);
    return rowsOf(t).filter((r) => set.has(r.id)).map((r) => ({ ...r }));
  },

  async linking(src: TableDef, linkField: FieldDef, ids: string[]): Promise<Row[]> {
    const set = new Set(ids);
    return rowsOf(src).filter((r) => idsOf(r[linkField.key]).some((id) => set.has(id))).map((r) => ({ ...r }));
  },

  async people() {
    return db().people;
  },

  async update(t: TableDef, id: string, patch: Record<string, unknown>, actor: Actor) {
    const r = rowsOf(t).find((x) => x.id === id);
    if (!r) throw new Error(`Could not find ${t.singular ?? "record"} ${id}`);
    const log = (db().activity[k(t, id)] ??= []);
    for (const [field, value] of Object.entries(patch)) {
      log.unshift({ id: crypto.randomUUID(), actor: actor.name, action: "update", field, oldValue: r[field], newValue: value, createdAt: new Date().toISOString() });
      r[field] = value;
    }
    r.updated_at = new Date().toISOString();
  },

  async create(t: TableDef, values: Record<string, unknown>, actor: Actor | null) {
    const id = `${t.key.slice(0, 4)}-${crypto.randomUUID().slice(0, 8)}`;
    rowsOf(t).push({ ...values, id, created_at: new Date().toISOString() });
    db().activity[k(t, id)] = [{ id: crypto.randomUUID(), actor: actor?.name ?? "Public form", action: "create", createdAt: new Date().toISOString() }];
    return id;
  },

  async comments(t: TableDef, id: string) {
    return db().comments[k(t, id)] ?? [];
  },

  async addComment(t: TableDef, id: string, body: string, actor: Actor) {
    (db().comments[k(t, id)] ??= []).push({ id: crypto.randomUUID(), author: actor.name, body, createdAt: new Date().toISOString() });
  },

  async activity(t: TableDef, id: string) {
    return db().activity[k(t, id)] ?? [];
  },

  async attachments(t: TableDef, id: string) {
    return db().attachments[k(t, id)] ?? [];
  },

  async runs() {
    return { automations: db().automationRuns, syncs: db().syncRuns };
  },
};
