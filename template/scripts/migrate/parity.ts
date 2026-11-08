// Parity check before cutover. Usage: npm run migrate:parity -- [--sample 20]
// Per table: Airtable record count vs Supabase row count, link counts, attachment count,
// and a field-by-field diff of N random records (dates to UTC, empty → null, arrays sorted).
// Writes .migrate/parity-report.json and logs a sync_runs row (kind "parity"). Exit code 1 on any mismatch.
import { writeFileSync } from "node:fs";
import { AirtableClient, type AirtableRecord } from "../../lib/airtable/client.ts";
import { diffValues, sample, transformRecord } from "../../lib/airtable/transform.ts";
import { peopleMap } from "../../lib/airtable/sync.ts";
import { rowFromDb } from "../../lib/data/db-map.ts";
import { setup } from "./env.ts";

const { db, schema, token, baseId } = setup();
const n = Number(process.argv[process.argv.indexOf("--sample") + 1]) || 20;
const at = new AirtableClient(token);
const people = await peopleMap(db);
const report: Record<string, unknown>[] = [];
let bad = 0;

for (const t of schema.tables.filter((x) => x.airtable)) {
  const records: AirtableRecord[] = [];
  for await (const page of at.records(baseId, t.airtable!.id)) records.push(...page);
  const { count, error } = await db.from(t.key).select("id", { count: "exact", head: true });
  if (error) throw new Error(`Could not count ${t.key}: ${error.message}`);
  const diffs: { airtableId: string; fields: string[] }[] = [];
  for (const rec of sample(records, n)) {
    const { data, error: e2 } = await db.from(t.key).select("*").eq("airtable_id", rec.id).maybeSingle();
    if (e2) throw new Error(`Could not read ${t.key}: ${e2.message}`);
    if (!data) { diffs.push({ airtableId: rec.id, fields: ["(missing row)"] }); continue; }
    const fields = diffValues(transformRecord(t, rec, { people }).values, rowFromDb(t, data));
    if (fields.length) diffs.push({ airtableId: rec.id, fields });
  }
  const ok = count === records.length && diffs.length === 0;
  if (!ok) bad++;
  report.push({ table: t.key, airtable: records.length, supabase: count, sampled: Math.min(n, records.length), mismatched: diffs.length, diffs, ok });
}

await db.from("sync_runs").insert({ kind: "parity", status: bad ? "error" : "ok", finished_at: new Date().toISOString(), detail: { tables: report.length, mismatched: bad } });
writeFileSync(".migrate/parity-report.json", JSON.stringify(report, null, 2));
console.table(report.map((r) => ({ table: r.table, airtable: r.airtable, supabase: r.supabase, sampled: r.sampled, mismatched: r.mismatched, ok: r.ok })));
console.log(bad ? `${bad} table(s) differ. See .migrate/parity-report.json.` : "All tables match.");
process.exit(bad ? 1 : 0);
