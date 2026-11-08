// Writes supabase/migrations/<n>_<name>.sql from app.schema.json.
// Usage: npm run schema:sql -- [name]   (default name: app_schema)
// Append-only: if a file for this schema already exists, write a new migration by hand for changes.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSchema } from "../lib/schema/validate.ts";
import { schemaToSql } from "../lib/schema/to-sql.ts";

const root = new URL("..", import.meta.url).pathname;
const result = validateSchema(JSON.parse(readFileSync(join(root, "app.schema.json"), "utf8")));
if (!result.ok || !result.schema) {
  console.error("app.schema.json has errors:\n- " + result.errors.join("\n- "));
  process.exit(1);
}
const dir = join(root, "supabase/migrations");
const files = readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
const next = String(files.length ? Number(files.at(-1)!.split("_")[0]) + 1 : 1).padStart(4, "0");
const name = (process.argv[2] ?? "app_schema").replace(/[^a-z0-9_]/g, "_");
const out = join(dir, `${next}_${name}.sql`);
writeFileSync(out, schemaToSql(result.schema));
for (const w of result.warnings) console.warn("warning: " + w);
console.log(`wrote ${out}`);
