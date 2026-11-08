// Mirrors public.app_can() in 0001_core.sql so the UI shows the same rights the database enforces.
// The database is the guard; this only decides what to show and what to disable.
import type { AppSchema } from "./schema/types.ts";

export type Action = "read" | "write";

export function canAccess(schema: AppSchema, role: string | null | undefined, table: string, action: Action): boolean {
  const def = schema.roles.find((r) => r.key === role);
  if (!def) return false;
  const list = action === "write" ? def.write : def.read;
  return list === "*" || list.includes(table);
}
