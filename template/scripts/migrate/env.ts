// Shared setup for the migration scripts. Reads .env.local if present. Never prints secrets.
import { existsSync, readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateSchema } from "../../lib/schema/validate.ts";
import type { AppSchema } from "../../lib/schema/types.ts";

export function loadEnvFile(path = ".env.local"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

export function need(name: string): string {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}. Put it in .env.local (see .env.example).`); process.exit(1); }
  return v;
}

export function setup(): { db: SupabaseClient; schema: AppSchema; token: string; baseId: string } {
  loadEnvFile();
  const r = validateSchema(JSON.parse(readFileSync("app.schema.json", "utf8")));
  if (!r.ok || !r.schema) { console.error("app.schema.json has errors:\n- " + r.errors.join("\n- ")); process.exit(1); }
  const db = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  return { db, schema: r.schema, token: need("AIRTABLE_PAT"), baseId: need("AIRTABLE_BASE_ID") };
}
