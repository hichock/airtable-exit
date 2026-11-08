// Loads and validates app.schema.json once per server process.
import raw from "../../app.schema.json";
import { validateSchema } from "./validate.ts";
import type { AppSchema, TableDef, ViewDef } from "./types.ts";

let cached: AppSchema | null = null;

export function loadSchema(): AppSchema {
  if (cached) return cached;
  const r = validateSchema(raw);
  if (!r.ok || !r.schema) throw new Error(`app.schema.json is not valid:\n- ${r.errors.join("\n- ")}`);
  cached = r.schema;
  return cached;
}

export function tableOrNull(s: AppSchema, key: string): TableDef | null {
  return s.tables.find((t) => t.key === key) ?? null;
}

export function viewOrNull(t: TableDef, key: string): ViewDef | null {
  return t.views.find((v) => v.key === key) ?? null;
}
