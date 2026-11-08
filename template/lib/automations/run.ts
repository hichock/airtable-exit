// Every automation and cron job runs inside withRun: one automation_runs row per run, errors recorded.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RunResult { items: number; detail?: Record<string, unknown>; skipped?: string }

export async function withRun(db: SupabaseClient | null, name: string, fn: () => Promise<RunResult>): Promise<RunResult & { status: string; error?: string }> {
  const started = db ? await db.from("automation_runs").insert({ automation: name }).select("id").single() : null;
  const id = started?.data?.id;
  try {
    const r = await fn();
    const status = r.skipped ? "skipped" : "ok";
    if (db && id) await db.from("automation_runs").update({ status, finished_at: new Date().toISOString(), items: r.items, detail: r.skipped ? { skipped: r.skipped } : (r.detail ?? null) }).eq("id", id);
    return { ...r, status };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (db && id) await db.from("automation_runs").update({ status: "error", finished_at: new Date().toISOString(), error }).eq("id", id);
    return { items: 0, status: "error", error };
  }
}
