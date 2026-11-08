// Where each field lives in Postgres. The SQL generator, the Supabase store and the
// migration scripts all call these, so the names agree in one place.

import type { FieldDef, TableDef } from "./types.ts";

export const SYSTEM_COLUMNS = ["id", "airtable_id", "created_at", "updated_at", "created_by"] as const;

export const RESERVED_TABLES = [
  "profiles",
  "app_roles",
  "comments",
  "activity",
  "attachments",
  "automation_runs",
  "sync_runs",
  "sync_state",
] as const;

export const KEY_PATTERN = /^[a-z][a-z0-9_]{0,50}$/;

/** The column that stores this field on its own table, or null when it lives elsewhere. */
export function columnOf(f: FieldDef): string | null {
  switch (f.type) {
    case "link":
      return f.link?.multiple ? null : `${f.key}_id`;
    case "user":
      return `${f.key}_id`;
    case "attachment":
    case "lookup":
    case "rollup":
      return null;
    case "formula":
      return f.computed?.kind === "formula" && f.computed.mode === "generated" ? f.key : null;
    case "createdTime":
      return "created_at";
    case "updatedTime":
      return "updated_at";
    default:
      return f.key;
  }
}

/** Junction table for a many-to-many link field. Columns: from_id, to_id. */
export function junctionOf(table: TableDef, f: FieldDef): string {
  return `${table.key}_${f.key}_links`;
}

export function findTable<T extends { key: string }>(tables: T[], key: string): T | undefined {
  return tables.find((t) => t.key === key);
}

export function findField(table: TableDef, key: string): FieldDef | undefined {
  return table.fields.find((f) => f.key === key);
}
