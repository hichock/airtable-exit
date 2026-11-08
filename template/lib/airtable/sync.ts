// Copy Airtable → Supabase. Used by scripts/migrate/copy.ts (full copy) and /api/cron/sync (nightly delta).
// Idempotent: every write is keyed by airtable_id, so a re-run updates instead of duplicating.
// Pass 1 per table: records (+ attachments downloaded in the same pass, URLs expire in 2 h).
// Pass 2: links, once every table's airtable_id → uuid map exists.

import type { SupabaseClient } from "@supabase/supabase-js";
import { columnOf, junctionOf } from "../schema/naming.ts";
import type { AppSchema, TableDef } from "../schema/types.ts";
import { AirtableClient, download, realDeps, type AirtableRecord, type Deps } from "./client.ts";
import { attachmentPath, transformRecord, type TransformCtx } from "./transform.ts";

export interface SyncOptions {
  kind: "copy" | "delta" | "final";
  /** ISO time; delta/final copy only records modified after it. */
  since?: string;
  comments?: boolean;
  log?: (msg: string) => void;
  /** Called with each raw page, e.g. to write a JSON snapshot (the snapshot is also the backup). */
  onPage?: (table: TableDef, records: AirtableRecord[]) => void | Promise<void>;
}

export interface TableResult {
  table: string;
  read: number;
  written: number;
  attachments: number;
  comments: number;
  warnings: string[];
}

type PendingLinks = Map<string, { recordAt: string; field: string; targets: string[] }[]>;

const BATCH = 500;

function check(what: string, error: { message: string } | null): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function deltaFormula(since: string): string {
  return `IS_AFTER(LAST_MODIFIED_TIME(), '${since.replace(/'/g, "")}')`;
}

/** Row values (field keys) → database columns for an import. */
export function importColumns(t: TableDef, values: Record<string, unknown>, airtableId: string): Record<string, unknown> {
  const row: Record<string, unknown> = { airtable_id: airtableId };
  if (values.__created_at) row.created_at = values.__created_at;
  for (const f of t.fields) {
    const c = columnOf(f);
    if (c && f.key in values && f.type !== "autoNumber") row[c] = values[f.key];
    if (f.type === "autoNumber" && f.key in values) row[f.key] = values[f.key];
  }
  return row;
}

export async function peopleMap(db: SupabaseClient): Promise<TransformCtx["people"]> {
  const { data, error } = await db.from("profiles").select("id,email,airtable_user_id");
  check("Could not load people", error);
  const m = new Map<string, string>();
  for (const p of data ?? []) {
    if (p.email) m.set(String(p.email).toLowerCase(), p.id);
    if (p.airtable_user_id) m.set(p.airtable_user_id, p.id);
  }
  return m;
}

export async function idMap(db: SupabaseClient, table: string): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("id,airtable_id").not("airtable_id", "is", null).order("id").range(from, from + 999);
    check(`Could not load ids of ${table}`, error);
    for (const r of data ?? []) m.set(r.airtable_id, r.id);
    if ((data ?? []).length < 1000) return m;
  }
}

async function copyAttachments(db: SupabaseClient, deps: Deps, t: TableDef, rec: AirtableRecord, recordId: string, items: ReturnType<typeof transformRecord>["attachments"]): Promise<number> {
  let n = 0;
  for (const { field, items: list } of items) {
    for (const a of list) {
      const path = attachmentPath(t.key, rec.id, a);
      const body = await download(deps, a);
      const up = await db.storage.from("attachments").upload(path, body, { upsert: true, contentType: a.type ?? "application/octet-stream" });
      check(`Could not store ${a.filename}`, up.error);
      const row = await db.from("attachments").upsert({ table_key: t.key, record_id: recordId, field, path, filename: a.filename, mime: a.type ?? null, size: a.size ?? null, airtable_id: a.id }, { onConflict: "airtable_id" });
      check(`Could not save ${a.filename}`, row.error);
      n++;
    }
  }
  return n;
}

async function copyComments(db: SupabaseClient, at: AirtableClient, baseId: string, t: TableDef, rec: AirtableRecord, recordId: string, people: TransformCtx["people"]): Promise<number> {
  if (!rec.commentCount || !t.airtable) return 0;
  const list = await at.comments(baseId, t.airtable.id, rec.id);
  const rows = list.map((c) => ({ table_key: t.key, record_id: recordId, body: c.text, created_at: c.createdTime, airtable_id: c.id, author_name: c.author.name ?? c.author.email ?? null, author_id: (c.author.email && people.get(c.author.email.toLowerCase())) || null }));
  if (rows.length) check("Could not save comments", (await db.from("comments").upsert(rows, { onConflict: "airtable_id" })).error);
  return rows.length;
}

async function copyTable(db: SupabaseClient, at: AirtableClient, deps: Deps, baseId: string, t: TableDef, people: TransformCtx["people"], pending: PendingLinks, opts: SyncOptions): Promise<TableResult> {
  const res: TableResult = { table: t.key, read: 0, written: 0, attachments: 0, comments: 0, warnings: [] };
  if (!t.airtable) return { ...res, warnings: ["no airtable.id in app.schema.json; skipped"] };
  const unmatched = new Set<string>();
  const filter = opts.since ? deltaFormula(opts.since) : undefined;
  const links = pending.get(t.key) ?? [];
  pending.set(t.key, links);
  for await (const page of at.records(baseId, t.airtable.id, filter ? { filterByFormula: filter, commentCount: opts.comments ?? false } : { commentCount: opts.comments ?? false })) {
    await opts.onPage?.(t, page);
    res.read += page.length;
    const tx = page.map((rec) => ({ rec, out: transformRecord(t, rec, { people }) }));
    const rows = tx.map(({ rec, out }) => importColumns(t, out.values, rec.id));
    const { data, error } = await db.from(t.key).upsert(rows, { onConflict: "airtable_id" }).select("id,airtable_id");
    check(`Could not write ${t.label}`, error);
    const ids = new Map((data ?? []).map((r) => [r.airtable_id as string, r.id as string]));
    res.written += ids.size;
    for (const { rec, out } of tx) {
      out.unmatchedUsers.forEach((u) => unmatched.add(u));
      res.warnings.push(...out.warnings.map((w) => `${rec.id} ${w}`));
      for (const l of out.links) links.push({ recordAt: rec.id, field: l.field, targets: l.airtableIds });
      const id = ids.get(rec.id);
      if (!id) continue;
      res.attachments += await copyAttachments(db, deps, t, rec, id, out.attachments);
      if (opts.comments) res.comments += await copyComments(db, at, baseId, t, rec, id, people);
    }
    opts.log?.(`${t.key}: ${res.read} read`);
  }
  if (unmatched.size) res.warnings.push(`${unmatched.size} people not found in profiles (invite them, then re-run): ${[...unmatched].slice(0, 5).join(", ")}`);
  return res;
}

async function writeLinks(db: SupabaseClient, schema: AppSchema, pending: PendingLinks, results: TableResult[]): Promise<void> {
  const maps = new Map<string, Map<string, string>>();
  const mapOf = async (k: string) => maps.get(k) ?? maps.set(k, await idMap(db, k)).get(k)!;
  for (const t of schema.tables) {
    const list = pending.get(t.key) ?? [];
    if (!list.length) continue;
    const own = await mapOf(t.key);
    const res = results.find((r) => r.table === t.key);
    for (const f of t.fields.filter((x) => x.type === "link" && x.link)) {
      const target = await mapOf(f.link!.table);
      const items = list.filter((l) => l.field === f.key && own.has(l.recordAt));
      let missing = 0;
      const resolve = (ids: string[]) => ids.map((a) => target.get(a) ?? (missing++, null)).filter((x): x is string => x !== null);
      if (!f.link!.multiple) {
        const rows = items.map((l) => ({ id: own.get(l.recordAt)!, [`${f.key}_id`]: resolve(l.targets.slice(0, 1))[0] ?? null }));
        for (let i = 0; i < rows.length; i += BATCH) check(`Could not link ${t.label}.${f.label}`, (await db.from(t.key).upsert(rows.slice(i, i + BATCH), { onConflict: "id" })).error);
      } else {
        const j = junctionOf(t, f);
        const fromIds = items.map((l) => own.get(l.recordAt)!);
        for (let i = 0; i < fromIds.length; i += BATCH) check(`Could not reset ${j}`, (await db.from(j).delete().in("from_id", fromIds.slice(i, i + BATCH))).error);
        const rows = items.flatMap((l) => resolve(l.targets).map((to_id, position) => ({ from_id: own.get(l.recordAt)!, to_id, position })));
        for (let i = 0; i < rows.length; i += BATCH) check(`Could not link ${t.label}.${f.label}`, (await db.from(j).upsert(rows.slice(i, i + BATCH), { onConflict: "from_id,to_id" })).error);
      }
      if (missing && res) res.warnings.push(`${f.key}: ${missing} links point at records that were not copied`);
    }
  }
}

/** Copies every table that has an airtable.id. Logs one sync_runs row per table. */
export async function syncAll(db: SupabaseClient, schema: AppSchema, token: string, baseId: string, opts: SyncOptions, deps: Deps = realDeps): Promise<TableResult[]> {
  const at = new AirtableClient(token, deps);
  const people = await peopleMap(db);
  const pending: PendingLinks = new Map();
  const results: TableResult[] = [];
  for (const t of schema.tables.filter((x) => x.airtable)) {
    const run = await db.from("sync_runs").insert({ kind: opts.kind, table_key: t.key }).select("id").single();
    check("Could not start the sync log", run.error);
    const runId = run.data?.id;
    try {
      const r = await copyTable(db, at, deps, baseId, t, people, pending, opts);
      results.push(r);
      await db.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), rows_read: r.read, rows_written: r.written, detail: { attachments: r.attachments, comments: r.comments, warnings: r.warnings.slice(0, 50) } }).eq("id", runId);
    } catch (e) {
      await db.from("sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) }).eq("id", runId);
      throw e;
    }
  }
  await writeLinks(db, schema, pending, results);
  return results;
}
