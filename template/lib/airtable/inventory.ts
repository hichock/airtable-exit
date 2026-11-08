// Discovery over the Airtable REST API: schema, people (counts), views, extensions, webhooks, and usage
// stats from one pass over the records (fill rate, created per month, duplicates, attachment bytes).
// The MCP-only parts (automations, interface pages, external accounts) are added by the discover skill.
// Endpoints and plan availability: Airtable Web API docs, read 2026-11-08.

import type { AirtableClient, AirtableRecord } from "./client.ts";

export interface FieldUsage { filled: number; fillRate: number }

export interface TableUsage {
  records: number;
  createdByMonth: Record<string, number>;
  firstCreated: string | null;
  lastCreated: string | null;
  modifiedLast90d: number | null;
  duplicatePrimary: number;
  attachments: { files: number; bytes: number };
  commentRecords: number;
  fields: Record<string, FieldUsage>;
  /** createdBy / lastModifiedBy / collaborator cells: user id → count. Goes to .migrate, not kb. */
  people: Record<string, number>;
}

type AnyObj = Record<string, unknown>;

/** Pure: usage stats for one table from its records. */
export function summarizeRecords(table: { primaryFieldId: string; fields: { id: string; type?: string }[] }, records: AirtableRecord[]): TableUsage {
  const u: TableUsage = { records: records.length, createdByMonth: {}, firstCreated: null, lastCreated: null, modifiedLast90d: null, duplicatePrimary: 0, attachments: { files: 0, bytes: 0 }, commentRecords: 0, fields: {}, people: {} };
  const seen = new Map<string, number>();
  const filled: Record<string, number> = Object.fromEntries(table.fields.map((f) => [f.id, 0]));
  const peopleTypes = new Set(["createdBy", "lastModifiedBy", "singleCollaborator", "multipleCollaborators"]);
  for (const r of records) {
    const month = r.createdTime.slice(0, 7);
    u.createdByMonth[month] = (u.createdByMonth[month] ?? 0) + 1;
    if (!u.firstCreated || r.createdTime < u.firstCreated) u.firstCreated = r.createdTime;
    if (!u.lastCreated || r.createdTime > u.lastCreated) u.lastCreated = r.createdTime;
    if ((r.commentCount ?? 0) > 0) u.commentRecords++;
    for (const f of table.fields) {
      const v = r.fields[f.id];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      filled[f.id] = (filled[f.id] ?? 0) + 1;
      if (f.type === "multipleAttachments" && Array.isArray(v)) {
        u.attachments.files += v.length;
        u.attachments.bytes += v.reduce((a: number, x) => a + Number((x as AnyObj).size ?? 0), 0);
      }
      if (peopleTypes.has(f.type ?? "")) {
        for (const p of Array.isArray(v) ? v : [v]) {
          const id = String((p as AnyObj).id ?? "");
          if (id) u.people[id] = (u.people[id] ?? 0) + 1;
        }
      }
    }
    const key = String(r.fields[table.primaryFieldId] ?? "").trim().toLowerCase();
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  u.duplicatePrimary = [...seen.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0);
  for (const [id, n] of Object.entries(filled)) u.fields[id] = { filled: n, fillRate: records.length ? Math.round((n / records.length) * 1000) / 1000 : 0 };
  return u;
}

export interface PersonCount { permissionLevel: string; count: number; via: "base" | "workspace" | "group" | "interface" }

/** Pure: collaborators → counts by permission level (kb) and a people list (for .migrate only). */
export function splitPeople(baseMeta: AnyObj): { counts: PersonCount[]; people: { userId?: string; email?: string; permissionLevel: string; via: string }[] } {
  const people: { userId?: string; email?: string; permissionLevel: string; via: string }[] = [];
  const collab = (baseMeta.collaborators ?? {}) as AnyObj;
  const push = (list: unknown, via: string) => {
    for (const c of (Array.isArray(list) ? list : []) as AnyObj[]) people.push({ userId: c.userId as string, email: c.email as string, permissionLevel: String(c.permissionLevel ?? "unknown"), via });
  };
  const base = (collab.baseCollaborators ?? {}) as AnyObj;
  const ws = (collab.workspaceCollaborators ?? {}) as AnyObj;
  push(base.individualCollaborators, "base");
  push(base.groupCollaborators, "group");
  push(ws.individualCollaborators, "workspace");
  push(ws.groupCollaborators, "group");
  const interfaces = (collab.interfaceCollaborators ?? baseMeta.interfaces ?? {}) as AnyObj;
  for (const i of Object.values(interfaces) as AnyObj[]) {
    const ic = ((i?.individualCollaborators ?? i?.collaborators) ?? []) as unknown;
    push(Array.isArray(ic) ? ic : ((ic as AnyObj).individualCollaborators ?? []), "interface");
  }
  const counts = new Map<string, PersonCount>();
  for (const p of people) {
    const k = `${p.via}:${p.permissionLevel}`;
    const c = counts.get(k) ?? { permissionLevel: p.permissionLevel, count: 0, via: p.via as PersonCount["via"] };
    c.count++;
    counts.set(k, c);
  }
  return { counts: [...counts.values()], people };
}

async function tryGet<T>(at: AirtableClient, path: string, notes: string[]): Promise<T | null> {
  try {
    return await at.get<T>(path);
  } catch (e) {
    notes.push(`${path.split("?")[0]}: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`);
    return null;
  }
}

export interface InventoryResult {
  inventory: AnyObj;
  people: AnyObj;
}

/** Reads one base. Never writes to Airtable. `activity` adds a LAST_MODIFIED_TIME() count per table (assumed formula). */
export async function inventoryBase(at: AirtableClient, baseId: string, opts: { activity: boolean; now: Date }): Promise<InventoryResult> {
  const notes: string[] = [];
  const meta = (await tryGet<AnyObj>(at, `meta/bases/${baseId}?include=collaborators&include=interfaces&include=inviteLinks`, notes)) ?? {};
  const schema = await at.get<{ tables: AnyObj[] }>(`meta/bases/${baseId}/tables?include=visibleFieldIds`);
  const views = await tryGet<{ views: AnyObj[] }>(at, `meta/bases/${baseId}/views`, notes);
  const blocks = await tryGet<AnyObj>(at, `meta/bases/${baseId}/blockInstallations`, notes);
  const hooks = await tryGet<AnyObj>(at, `bases/${baseId}/webhooks`, notes);
  const since = new Date(opts.now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
  const tables: AnyObj[] = [];
  const peopleByTable: AnyObj = {};
  for (const t of schema.tables) {
    const fields = (t.fields as { id: string; type?: string }[]) ?? [];
    const records: AirtableRecord[] = [];
    for await (const page of at.records(baseId, String(t.id), { commentCount: true })) records.push(...page);
    const usage = summarizeRecords({ primaryFieldId: String(t.primaryFieldId), fields }, records);
    if (opts.activity) {
      let n = 0;
      for await (const page of at.records(baseId, String(t.id), { filterByFormula: `IS_AFTER(LAST_MODIFIED_TIME(), '${since}')` })) n += page.length;
      usage.modifiedLast90d = n;
    }
    peopleByTable[String(t.id)] = usage.people;
    const flatViews = (views?.views ?? []).filter((v) => (t.views as AnyObj[] | undefined)?.some((tv) => tv.id === v.id));
    const viewList = ((t.views as AnyObj[]) ?? []).map((v) => ({ ...v, ...(flatViews.find((f) => f.id === v.id) ?? {}) }));
    tables.push({ ...t, views: viewList, recordCount: records.length, usage: { ...usage, people: Object.keys(usage.people).length } });
  }
  const split = splitPeople(meta);
  const interfaces = Object.entries((meta.interfaces ?? {}) as AnyObj).map(([id, i]) => ({ id, ...(i as AnyObj), collaborators: undefined }));
  return {
    inventory: {
      id: baseId,
      workspaceId: meta.workspaceId ?? null,
      people: split.counts,
      inviteLinks: Array.isArray((meta.inviteLinks as AnyObj | undefined)?.baseInviteLinks) ? ((meta.inviteLinks as AnyObj).baseInviteLinks as unknown[]).length : null,
      interfaces,
      extensions: (blocks?.blockInstallations as AnyObj[] | undefined)?.map((b) => ({ id: b.id, state: b.state, blockSlug: b.blockSlug ?? null })) ?? null,
      webhooks: (hooks?.webhooks as AnyObj[] | undefined)?.map((h) => ({ id: h.id, notificationUrlHost: h.notificationUrl ? new URL(String(h.notificationUrl)).host : null, isHookEnabled: h.isHookEnabled, expirationTime: h.expirationTime })) ?? null,
      tables,
      automations: "add with MCP list_automations / get_automation (discover skill)",
      notes,
    },
    people: { baseId, collaborators: split.people, activityByTable: peopleByTable },
  };
}
