// Validates app.schema.json and prints errors and warnings. Exit code 1 on errors.
import { readFileSync } from "node:fs";
import { validateSchema } from "../lib/schema/validate.ts";

const path = process.argv[2] ?? new URL("../app.schema.json", import.meta.url).pathname;
const r = validateSchema(JSON.parse(readFileSync(path, "utf8")));
for (const e of r.errors) console.error("error: " + e);
for (const w of r.warnings) console.warn("warning: " + w);
console.log(r.ok ? `ok: ${r.schema?.tables.length} tables` : `${r.errors.length} error(s)`);
process.exit(r.ok ? 0 : 1);
