// Cron entry point (vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
// Each job runs inside withRun, so every run lands in automation_runs and shows on the System page.
import { NextResponse, type NextRequest } from "next/server";
import { getMode } from "@/lib/env";
import { loadSchema } from "@/lib/schema/load";
import { adminClient } from "@/lib/supabase/server";
import { supabaseStore } from "@/lib/data/supabase-store";
import { demoStore } from "@/lib/demo/store";
import { withRun, type RunResult } from "@/lib/automations/run";
import { runStaleDeals } from "@/lib/automations/stale-deals";
import { syncAll } from "@/lib/airtable/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Job = (ctx: { db: ReturnType<typeof adminClient> }) => Promise<RunResult>;

const JOBS: Record<string, Job> = {
  "stale-deals": async ({ db }) => runStaleDeals(loadSchema(), db ? supabaseStore(db) : demoStore),

  // Nightly delta from Airtable during the parallel run. Off unless SYNC_ENABLED=1.
  sync: async ({ db }) => {
    if (process.env.SYNC_ENABLED !== "1") return { items: 0, skipped: "SYNC_ENABLED is not 1" };
    const token = process.env.AIRTABLE_PAT, base = process.env.AIRTABLE_BASE_ID;
    if (!db || !token || !base) return { items: 0, skipped: "missing AIRTABLE_PAT, AIRTABLE_BASE_ID or Supabase service key" };
    const { data, error } = await db.from("sync_state").select("last_synced_at").order("last_synced_at").limit(1).maybeSingle();
    if (error) throw new Error(`Could not load sync state: ${error.message}`);
    const startedAt = new Date().toISOString();
    const since = data?.last_synced_at ?? new Date(Date.now() - 2 * 86_400_000).toISOString();
    const results = await syncAll(db, loadSchema(), token, base, { kind: "delta", since });
    const up = await db.from("sync_state").upsert(results.map((r) => ({ table_key: r.table, last_synced_at: startedAt })));
    if (up.error) throw new Error(`Could not save sync state: ${up.error.message}`);
    return { items: results.reduce((a, r) => a + r.written, 0), detail: { since, tables: results.map((r) => ({ table: r.table, read: r.read, written: r.written, warnings: r.warnings.length })) } };
  },
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ job: string }> }) {
  const { job } = await ctx.params;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const fn = JOBS[job];
  if (!fn) return NextResponse.json({ error: `unknown job ${job}` }, { status: 404 });
  const mode = getMode();
  const db = mode.kind === "supabase" ? adminClient(mode.url) : null;
  // Rebuilt automations stay off until cutover, so they never double-fire with Airtable's own automations.
  const gated = job !== "sync" && mode.kind === "supabase" && process.env.AUTOMATIONS_ENABLED !== "1";
  const result = await withRun(db, job, gated ? async () => ({ items: 0, skipped: "AUTOMATIONS_ENABLED is not 1 (turn on at cutover)" }) : () => fn({ db }));
  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}
