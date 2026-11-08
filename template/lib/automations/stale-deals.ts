// Example of a rebuilt Airtable automation: "When a deal has had no update for 14 days, create a follow-up task".
// decide() is pure and tested; run() loads, decides, writes. Idempotent: an open follow-up for the deal blocks a new one.
import type { AppSchema } from "../schema/types.ts";
import type { Row, Store } from "../data/types.ts";
import { findTable } from "../schema/naming.ts";
import type { RunResult } from "./run.ts";

export const STALE_DAYS = 14;
export const TASK_TITLE = "Follow up: no activity for 14 days";

export function decideStaleDeals(deals: Row[], tasks: Row[], now: Date): Row[] {
  const cutoff = now.getTime() - STALE_DAYS * 86_400_000;
  const hasOpen = new Set(tasks.filter((t) => t.title === TASK_TITLE && t.status !== "Done").map((t) => String(t.deal)));
  return deals.filter((d) => {
    if (d.stage === "Won" || d.stage === "Lost") return false;
    const touched = Date.parse(String(d.updated_at ?? d.created_at ?? ""));
    return Number.isFinite(touched) && touched < cutoff && !hasOpen.has(d.id);
  });
}

export async function runStaleDeals(schema: AppSchema, store: Store, now = new Date()): Promise<RunResult> {
  const deals = findTable(schema.tables, "deals");
  const tasks = findTable(schema.tables, "tasks");
  if (!deals || !tasks) return { items: 0, skipped: "this app has no deals/tasks tables" };
  const stale = decideStaleDeals(await store.all(deals, []), await store.all(tasks, [{ field: "title", op: "eq", value: TASK_TITLE }]), now);
  const due = new Date(now.getTime() + 2 * 86_400_000).toISOString().slice(0, 10);
  for (const d of stale) {
    await store.create(tasks, { title: TASK_TITLE, status: "To do", priority: "Medium", due, deal: d.id, company: d.company ?? null, assignee: d.owner ?? null }, null);
  }
  return { items: stale.length, detail: { created: stale.length } };
}
