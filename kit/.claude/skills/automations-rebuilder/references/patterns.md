# Trigger and action patterns

Airtable trigger types and step inputs come from MCP `get_automation` (sourced: Airtable MCP tools reference,
read 2026-11-08). Targets are our choices (**assumed**). Vercel cron syntax: `vercel.json` → `crons[]`.

| Airtable trigger | Target here | Notes |
|---|---|---|
| At a scheduled time | Vercel cron → `/api/cron/<job>` (JOBS registry) | Cron is UTC. Vercel Hobby (free) allows daily jobs only, timing within the hour (sourced, Vercel cron docs, 2026-11-09) |
| When a record is created | Server action after `store.create`, or Postgres `after insert` trigger + pg_net | App path is simpler; trigger catches every writer |
| When a record is updated / matches conditions | Compare old/new in `updateFieldAction`, or `after update` trigger with a `when (old.x is distinct from new.x)` clause | Guard against imports |
| When a form is submitted | `createRecordAction` / `submitPublicFormAction` | Public forms run with the service role |
| When a webhook is received | `app/api/hooks/<name>/route.ts`, secret in a header | Give the sender the new URL at cutover |
| Button clicked | Server action from the record page | Buttons with URLs become links |

| Airtable action | Code |
|---|---|
| Create / update record | `store.create(table, values, null)` / `store.update(...)` |
| Find records | `store.all(table, filters)` (pages past 1,000 rows) |
| Send email | Provider HTTP API (Resend, Postmark, SES…); key in env; owner picks; cost `needs input` |
| Slack message | POST to an incoming webhook URL (env secret) |
| Run script | Port to TypeScript in `lib/automations/`, pure core + test |
| Generate with AI | Edge Function or route calling the owner's provider; key in env |

Cron job skeleton (copy `lib/automations/stale-deals.ts`):
```ts
export function decideX(rows: Row[], now: Date): Row[] { /* pure */ }
export async function runX(schema: AppSchema, store: Store, now = new Date()): Promise<RunResult> {
  const t = findTable(schema.tables, "deals"); if (!t) return { items: 0, skipped: "no deals table" };
  const due = decideX(await store.all(t, []), now);
  for (const r of due) await store.update(t, r.id, { flagged: true }, null); // null actor = logged as "automation"
  return { items: due.length };
}
// app/api/cron/[job]/route.ts → JOBS["x"] = async ({ db }) => runX(loadSchema(), db ? supabaseStore(db) : demoStore);
// vercel.json → { "path": "/api/cron/x", "schedule": "10 7 * * 1-5" }
```
