// Usage: npm run schema:from-airtable -- <inventory.json> [--base appXXX] [--out app.schema.json] [--notes kb/schema.md] [--name "Our CRM"]
// Writes a draft app.schema.json and the mapping notes. Review the notes before generating SQL (npm run schema:sql).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { draftFromBase, notesMarkdown, type AtBase } from "./map.ts";
import { validateSchema } from "../../lib/schema/validate.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const input = process.argv[2];
if (!input || input.startsWith("--")) {
  console.error("Usage: npm run schema:from-airtable -- <inventory.json> [--base appXXX] [--out app.schema.json] [--notes kb/schema.md]");
  process.exit(1);
}
const inv = JSON.parse(readFileSync(input, "utf8")) as { bases: AtBase[] };
const base = arg("base") ? inv.bases.find((b) => b.id === arg("base")) : inv.bases[0];
if (!base) { console.error(`Base ${arg("base") ?? "(first)"} not found in ${input}`); process.exit(1); }
const draft = draftFromBase(base, arg("name") ?? base.name);
const check = validateSchema(draft.schema);
const out = arg("out") ?? "app.schema.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(draft.schema, null, 2) + "\n");
const notesPath = arg("notes") ?? "kb/schema.md";
mkdirSync(dirname(notesPath), { recursive: true });
writeFileSync(notesPath, `# Schema mapping: ${base.name}\n\nStatus: draft (generated ${new Date().toISOString().slice(0, 10)} from ${input}). Edit app.schema.json, not this table.\n\n${notesMarkdown(draft)}`);
console.log(`wrote ${out} and ${notesPath}`);
for (const e of check.errors) console.error("error: " + e);
for (const w of check.warnings) console.warn("warning: " + w);
process.exit(check.ok ? 0 : 1);
