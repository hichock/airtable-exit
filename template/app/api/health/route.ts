// Health check. Public: { ok, mode, app }. With "Authorization: Bearer $CRON_SECRET" it adds run and sync
// status for the weekly health skill. Never returns secrets or record contents.
import { NextResponse, type NextRequest } from "next/server";
import { getMode } from "@/lib/env";
import { loadSchema } from "@/lib/schema/load";
import { adminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function detail(url: string) {
  const db = adminClient(url);
  if (!db) return { error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [runs, sync, people] = await Promise.all([
    db.from("automation_runs").select("automation,status,started_at,error").gte("started_at", since).order("started_at", { ascending: false }).limit(500),
    db.from("sync_runs").select("kind,table_key,status,started_at,rows_read,rows_written,error").order("started_at", { ascending: false }).limit(20),
    db.from("profiles").select("role", { count: "exact", head: false }).limit(1000),
  ]);
  const counts: Record<string, number | string> = {};
  for (const t of loadSchema().tables) {
    const { count, error } = await db.from(t.key).select("id", { count: "exact", head: true });
    counts[t.key] = error ? `Could not load: ${error.message}` : (count ?? 0);
  }
  const byStatus = (runs.data ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [`${r.automation}:${r.status}`]: (a[`${r.automation}:${r.status}`] ?? 0) + 1 }), {});
  return {
    automationRuns7d: runs.error ? `Could not load: ${runs.error.message}` : byStatus,
    automationErrors7d: (runs.data ?? []).filter((r) => r.status === "error").slice(0, 10),
    lastSyncs: sync.error ? `Could not load: ${sync.error.message}` : sync.data,
    rows: counts,
    people: people.error ? `Could not load: ${people.error.message}` : (people.data ?? []).reduce<Record<string, number>>((a, p) => ({ ...a, [p.role]: (a[p.role] ?? 0) + 1 }), {}),
    flags: { syncEnabled: process.env.SYNC_ENABLED === "1", automationsEnabled: process.env.AUTOMATIONS_ENABLED === "1" },
  };
}

export async function GET(req: NextRequest) {
  const mode = getMode();
  const schema = loadSchema();
  const base = { ok: true, mode: mode.kind, app: schema.app.name, tables: schema.tables.length, time: new Date().toISOString() };
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}` || mode.kind !== "supabase") return NextResponse.json(base);
  return NextResponse.json({ ...base, detail: await detail(mode.url) });
}
