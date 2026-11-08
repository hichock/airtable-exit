// Usage: npm run airtable:inventory -- [appXXX ...] [--activity]
// Reads the base(s) over the REST API with AIRTABLE_PAT (read-only). Writes:
//   kb/airtable/inventory.json  schema, views, counts, usage stats, people counts (no emails, no records)
//   .migrate/people.json        collaborators with emails and activity per user (gitignored, for invites)
// Then the discover skill adds automations, interface pages and external accounts from the Airtable MCP.
import { mkdirSync, writeFileSync } from "node:fs";
import { AirtableClient } from "../../lib/airtable/client.ts";
import { inventoryBase } from "../../lib/airtable/inventory.ts";
import { loadEnvFile, need } from "../migrate/env.ts";

loadEnvFile();
const at = new AirtableClient(need("AIRTABLE_PAT"));
const ids = process.argv.slice(2).filter((a) => a.startsWith("app"));
const activity = process.argv.includes("--activity");

const who = await at.get<{ id: string; scopes?: string[] }>("meta/whoami");
const bases: { id: string; name: string; permissionLevel: string }[] = [];
let offset: string | undefined;
do {
  const page = await at.get<{ bases: typeof bases; offset?: string }>(`meta/bases${offset ? `?offset=${offset}` : ""}`);
  bases.push(...page.bases);
  offset = page.offset;
} while (offset);
const chosen = (ids.length ? ids : [need("AIRTABLE_BASE_ID")]).map((id) => bases.find((b) => b.id === id) ?? { id, name: id, permissionLevel: "unknown" });

const out: Record<string, unknown>[] = [];
const people: Record<string, unknown>[] = [];
for (const b of chosen) {
  console.log(`Reading ${b.name} (${b.id})…`);
  const r = await inventoryBase(at, b.id, { activity, now: new Date() });
  out.push({ name: b.name, permissionLevel: b.permissionLevel, ...r.inventory });
  people.push(r.people);
}
mkdirSync("kb/airtable", { recursive: true });
mkdirSync(".migrate", { recursive: true });
writeFileSync("kb/airtable/inventory.json", JSON.stringify({ generatedAt: new Date().toISOString(), source: "Airtable REST API (read-only token)", userId: who.id, basesVisible: bases.length, bases: out }, null, 2) + "\n");
writeFileSync(".migrate/people.json", JSON.stringify(people, null, 2) + "\n");
for (const b of out) {
  const tables = b.tables as { name: string; recordCount: number; fields: unknown[]; usage: { attachments: { bytes: number }; modifiedLast90d: number | null } }[];
  console.table(tables.map((t) => ({ table: t.name, records: t.recordCount, fields: t.fields.length, attachmentMB: Math.round(t.usage.attachments.bytes / 1e5) / 10, modified90d: t.usage.modifiedLast90d ?? "n/a" })));
  for (const n of b.notes as string[]) console.warn(`note: ${n}`);
}
console.log("wrote kb/airtable/inventory.json and .migrate/people.json");
