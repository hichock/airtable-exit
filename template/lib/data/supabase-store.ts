// Store backed by Supabase. Reads as the signed-in user (RLS applies). Every failed read throws
// "Could not load …" so pages show an error, never an empty list that looks like a fact.

import type { SupabaseClient } from "@supabase/supabase-js";
import { columnOf, junctionOf } from "../schema/naming.ts";
import type { FieldDef, Filter, TableDef } from "../schema/types.ts";
import { resolveValue } from "./query.ts";
import { hasComputedView, patchToDb, readColumn, rowFromDb } from "./db-map.ts";
import type { Actor, Page, Query, Row, Store } from "./types.ts";

const PAGE_CAP = 1000; // Supabase returns at most 1,000 rows per request.
const IN_CHUNK = 200;

type Builder = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

function fail(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`Could not load ${what}: ${error.message}`);
}

function source(t: TableDef): string {
  return hasComputedView(t) ? `${t.key}_computed` : t.key;
}

function quoted(v: unknown): string {
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

/** Applies one filter in SQL. Returns false when it can't run on the server. */
function applyFilter(b: Builder, t: TableDef, f: Filter): boolean {
  const field = t.fields.find((x) => x.key === f.field);
  const col = field ? readColumn(field) : null;
  if (!field || !col) return false;
  const v = resolveValue(f.value, new Date());
  const multi = field.type === "multiSelect";
  switch (f.op) {
    case "eq": multi ? b.contains(col, [v]) : b.eq(col, v as string); return true;
    case "neq": b.or(multi ? `${col}.is.null,${col}.not.cs.{${quoted(v)}}` : `${col}.is.null,${col}.neq.${quoted(v)}`); return true;
    case "contains": b.ilike(col, `%${String(v)}%`); return true;
    case "gt": b.gt(col, v as string); return true;
    case "gte": b.gte(col, v as string); return true;
    case "lt": b.lt(col, v as string); return true;
    case "lte": b.lte(col, v as string); return true;
    case "empty": b.or(`${col}.is.null${["text", "longText", "email", "url", "phone"].includes(field.type) ? `,${col}.eq.""` : ""}`); return true;
    case "notEmpty": b.not(col, "is", null); return true;
    case "in": b.in(col, Array.isArray(v) ? v : [String(v)]); return true;
  }
}

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function supabaseStore(client: SupabaseClient): Store {
  async function attachLinks(t: TableDef, rows: Row[]): Promise<Row[]> {
    const multi = t.fields.filter((f) => f.type === "link" && f.link?.multiple);
    if (!multi.length || !rows.length) return rows;
    for (const f of multi) {
      for (const r of rows) r[f.key] = [];
      for (const ids of chunks(rows.map((r) => r.id), IN_CHUNK)) {
        const { data, error } = await client.from(junctionOf(t, f)).select("from_id,to_id").in("from_id", ids).order("position");
        fail(`${t.label} links`, error);
        for (const j of data ?? []) {
          const r = rows.find((x) => x.id === j.from_id);
          (r?.[f.key] as string[] | undefined)?.push(String(j.to_id));
        }
      }
    }
    return rows;
  }

  async function byIds(t: TableDef, ids: string[]): Promise<Row[]> {
    const out: Row[] = [];
    for (const part of chunks([...new Set(ids)], IN_CHUNK)) {
      const { data, error } = await client.from(source(t)).select("*").in("id", part);
      fail(t.label, error);
      out.push(...(data ?? []).map((r) => rowFromDb(t, r)));
    }
    return attachLinks(t, out);
  }

  async function writeLinks(t: TableDef, id: string, links: { field: FieldDef; ids: string[] }[]): Promise<void> {
    for (const { field, ids } of links) {
      const j = junctionOf(t, field);
      const del = await client.from(j).delete().eq("from_id", id);
      fail(`${t.label} links`, del.error);
      if (!ids.length) continue;
      const ins = await client.from(j).insert(ids.map((to_id, position) => ({ from_id: id, to_id, position })));
      fail(`${t.label} links`, ins.error);
    }
  }

  // actor null = automation or public form (service-role client): logged without a person.
  async function logActivity(t: TableDef, id: string, actor: Actor | null, rows: { action: string; field?: string; old_value?: unknown; new_value?: unknown }[]) {
    if (!rows.length) return;
    const { error } = await client.from("activity").insert(rows.map((r) => ({ table_key: t.key, record_id: id, actor_id: actor?.id ?? null, ...r, action: actor || r.action === "create" ? r.action : "automation" })));
    fail("activity", error);
  }

  return {
    mode: "supabase",

    async list(t: TableDef, q: Query): Promise<Page> {
      const notices: string[] = [];
      const from = (q.page - 1) * q.pageSize;
      const b = client.from(source(t)).select("*", { count: "exact" });
      for (const f of q.filters) if (!applyFilter(b, t, f)) notices.push(`The filter on "${f.field}" can't run on the server and was skipped.`);
      const primary = t.fields.find((f) => f.key === t.primaryField);
      const pcol = primary ? readColumn(primary) : null;
      if (q.search && pcol) b.ilike(pcol, `%${q.search}%`);
      for (const s of q.sorts) {
        const f = t.fields.find((x) => x.key === s.field);
        const col = f ? readColumn(f) : null;
        if (col) b.order(col, { ascending: s.dir === "asc", nullsFirst: false });
        else notices.push(`Sorting by "${s.field}" isn't available on the server.`);
      }
      b.order("id").range(from, from + q.pageSize - 1);
      const { data, error, count } = await b;
      fail(t.label, error);
      const rows = await attachLinks(t, (data ?? []).map((r) => rowFromDb(t, r)));
      return { rows, total: count ?? rows.length, page: q.page, pageSize: q.pageSize, notices };
    },

    async all(t: TableDef, filters: Filter[]): Promise<Row[]> {
      const out: Row[] = [];
      for (let from = 0; ; from += PAGE_CAP) {
        const b = client.from(source(t)).select("*");
        for (const f of filters) applyFilter(b, t, f);
        const { data, error } = await b.order("id").range(from, from + PAGE_CAP - 1);
        fail(t.label, error);
        out.push(...(data ?? []).map((r) => rowFromDb(t, r)));
        if ((data ?? []).length < PAGE_CAP) break;
      }
      return attachLinks(t, out);
    },

    async get(t: TableDef, id: string) {
      return (await byIds(t, [id]))[0] ?? null;
    },

    byIds,

    async linking(src: TableDef, linkField: FieldDef, ids: string[]) {
      if (!linkField.link?.multiple) {
        const col = columnOf(linkField) as string;
        const out: Row[] = [];
        for (const part of chunks(ids, IN_CHUNK)) {
          const { data, error } = await client.from(source(src)).select("*").in(col, part);
          fail(src.label, error);
          out.push(...(data ?? []).map((r) => rowFromDb(src, r)));
        }
        return attachLinks(src, out);
      }
      const fromIds: string[] = [];
      for (const part of chunks(ids, IN_CHUNK)) {
        const { data, error } = await client.from(junctionOf(src, linkField)).select("from_id").in("to_id", part);
        fail(`${src.label} links`, error);
        fromIds.push(...(data ?? []).map((j) => String(j.from_id)));
      }
      return byIds(src, fromIds);
    },

    async people() {
      const { data, error } = await client.from("profiles").select("id,email,full_name,role").eq("active", true).order("email");
      fail("people", error);
      return (data ?? []).map((p) => ({ id: p.id, email: p.email, name: p.full_name || p.email, role: p.role }));
    },

    async update(t: TableDef, id: string, patch: Record<string, unknown>, actor: Actor | null) {
      const before = await byIds(t, [id]);
      const { columns, links } = patchToDb(t, patch);
      if (Object.keys(columns).length) {
        const { error } = await client.from(t.key).update(columns).eq("id", id);
        if (error) throw new Error(`Could not save: ${error.message}`);
      }
      await writeLinks(t, id, links);
      await logActivity(t, id, actor, Object.entries(patch).map(([field, value]) => ({ action: "update", field, old_value: before[0]?.[field] ?? null, new_value: value })));
    },

    async create(t: TableDef, values: Record<string, unknown>, actor: Actor | null) {
      const { columns, links } = patchToDb(t, values);
      if (actor) columns.created_by = actor.id;
      const { data, error } = await client.from(t.key).insert(columns).select("id").single();
      if (error || !data) throw new Error(`Could not create: ${error?.message ?? "no id returned"}`);
      await writeLinks(t, data.id, links);
      await logActivity(t, data.id, actor, [{ action: "create" }]);
      return String(data.id);
    },

    async comments(t: TableDef, id: string) {
      const { data, error } = await client.from("comments").select("id,body,created_at,author_name,author:profiles(full_name,email)").eq("table_key", t.key).eq("record_id", id).order("created_at");
      fail("comments", error);
      return (data ?? []).map((c) => {
        const a = (Array.isArray(c.author) ? c.author[0] : c.author) as { full_name?: string; email?: string } | null;
        return { id: String(c.id), body: c.body, createdAt: c.created_at, author: a?.full_name || a?.email || c.author_name || "Unknown" };
      });
    },

    async addComment(t: TableDef, id: string, body: string, actor: Actor) {
      const { error } = await client.from("comments").insert({ table_key: t.key, record_id: id, author_id: actor.id, body });
      if (error) throw new Error(`Could not add the comment: ${error.message}`);
    },

    async activity(t: TableDef, id: string) {
      const { data, error } = await client.from("activity").select("id,action,field,old_value,new_value,created_at,actor:profiles(full_name,email)").eq("table_key", t.key).eq("record_id", id).order("created_at", { ascending: false }).limit(50);
      fail("activity", error);
      return (data ?? []).map((a) => {
        const p = (Array.isArray(a.actor) ? a.actor[0] : a.actor) as { full_name?: string; email?: string } | null;
        return { id: String(a.id), action: a.action, field: a.field ?? undefined, oldValue: a.old_value, newValue: a.new_value, createdAt: a.created_at, actor: p?.full_name || p?.email || "System" };
      });
    },

    async attachments(t: TableDef, id: string) {
      const { data, error } = await client.from("attachments").select("id,field,path,filename,mime,size").eq("table_key", t.key).eq("record_id", id).order("created_at");
      fail("attachments", error);
      const rows = data ?? [];
      const signed = rows.length ? await client.storage.from("attachments").createSignedUrls(rows.map((r) => r.path), 3600) : { data: [], error: null };
      fail("attachment links", signed.error);
      return rows.map((r, i) => ({ id: String(r.id), field: r.field, filename: r.filename, mime: r.mime ?? undefined, size: r.size ?? undefined, url: signed.data?.[i]?.signedUrl ?? undefined }));
    },

    async runs() {
      const [a, s] = await Promise.all([
        client.from("automation_runs").select("*").order("started_at", { ascending: false }).limit(50),
        client.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(50),
      ]);
      fail("automation runs", a.error);
      fail("sync runs", s.error);
      const text = (d: unknown) => (d ? JSON.stringify(d) : undefined);
      return {
        automations: (a.data ?? []).map((r) => ({ id: String(r.id), name: r.automation, status: r.status, startedAt: r.started_at, finishedAt: r.finished_at ?? undefined, detail: text(r.detail), error: r.error ?? undefined })),
        syncs: (s.data ?? []).map((r) => ({ id: String(r.id), name: `${r.kind}: ${r.table_key ?? "all tables"}`, status: r.status, startedAt: r.started_at, finishedAt: r.finished_at ?? undefined, detail: `${r.rows_read} read, ${r.rows_written} written`, error: r.error ?? undefined })),
      };
    },
  };
}
