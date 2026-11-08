// Which mode the app runs in. DEMO=1, or missing Supabase settings, means in-memory demo data.
// The app never crashes for missing env: it shows demo data and says why in a banner.

export type Mode = { kind: "demo"; reason: "flag" | "no-env" } | { kind: "supabase"; url: string; anonKey: string };

export function getMode(env: Record<string, string | undefined> = process.env): Mode {
  if (env.DEMO === "1") return { kind: "demo", reason: "flag" };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { kind: "demo", reason: "no-env" };
  return { kind: "supabase", url, anonKey };
}

export function serviceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || undefined;
}
