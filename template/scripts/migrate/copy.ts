// Full copy Airtable → Supabase. Usage: npm run migrate:copy -- [--comments] [--since 2026-11-01T00:00:00Z] [--final]
// 1. Raw JSON snapshot per table in .migrate/snapshot/ (also your backup). 2. Typed upsert keyed by airtable_id.
// 3. Attachments downloaded in the same pass (URLs expire after 2 h) to Storage. 4. Links in a second pass.
// Safe to re-run: it updates rows instead of duplicating them. Writes .migrate/copy-report.json.
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { syncAll } from "../../lib/airtable/sync.ts";
import { setup } from "./env.ts";

const { db, schema, token, baseId } = setup();
const since = process.argv.includes("--since") ? process.argv[process.argv.indexOf("--since") + 1] : undefined;
const kind = process.argv.includes("--final") ? "final" : since ? "delta" : "copy";
mkdirSync(".migrate/snapshot", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const started = Date.now();

const results = await syncAll(db, schema, token, baseId, {
  kind,
  ...(since ? { since } : {}),
  comments: process.argv.includes("--comments"),
  log: (m) => console.log(m),
  onPage: (t, records) => appendFileSync(`.migrate/snapshot/${stamp}-${t.key}.jsonl`, records.map((r) => JSON.stringify(r)).join("\n") + "\n"),
});

const report = { kind, since: since ?? null, startedAt: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000), tables: results };
writeFileSync(".migrate/copy-report.json", JSON.stringify(report, null, 2));
console.table(results.map((r) => ({ table: r.table, read: r.read, written: r.written, files: r.attachments, comments: r.comments, warnings: r.warnings.length })));
for (const r of results) for (const w of r.warnings.slice(0, 10)) console.warn(`${r.table}: ${w}`);
console.log(`Done in ${report.seconds}s. Report: .migrate/copy-report.json. Next: npm run migrate:parity`);
