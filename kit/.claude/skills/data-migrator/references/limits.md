# Copy limits and tools

Sources: Airtable Web API docs (rate limits, list records, attachments), Supabase storage limits, GitHub API for
repo stats; all read 2026-11-08. **sourced** unless marked.

- 5 requests/s per base; 50 requests/s per user across PAT traffic; 429 → wait 30 s.
- 100 records per page → at most about 500 records/s per base. 125k records (the Business cap) is about 4 minutes
  of pure requests (**derived**). Attachment downloads come from Airtable's file CDN, not the API (**assumed**).
- Team plan: 100,000 API calls per workspace per month, then throttled to 2 req/s. Free: 1,000. MCP calls count too.
- Attachment URLs expire 2 hours after the API returns them: download in the same pass.
- Supabase Free: 50 MB per uploaded file and 1 GB in total; Pro: 100 GB files included, per-file limit up to 500 GB
  (supabase.com/pricing and storage file-limits docs, read 2026-11-09). The copy skips files over `MAX_FILE_MB`
  (default 50) and lists them in `.migrate/copy-report.json`.
- Revision history is not copied (Enterprise-only API). Comments are copied with `--comments`.

Tools to reuse instead of rebuilding (stars and dates from GitHub API, 2026-11-08):
| Tool | Use | Limits |
|---|---|---|
| This template's `migrate:copy` (Node, lib/airtable) | Main path: typed, idempotent, attachments, links | Tested with unit tests and fakes; first live run is yours |
| pyairtable (MIT, 891★, pushed 2026-11-08) | Python alternative with retries; schema, records, comments | Python in a Node repo |
| Supabase Airtable FDW (Apache-2.0, 900★) | Read-only mirror inside Postgres: `insert into … select … from airtable_fdw` | No pushdown; links/attachments/selects as jsonb; formula fields reported broken by Whalesync |
| NocoDB / Baserow import | Only tools that bring view filters/sorts/groups across (via share link) | Other apps, not Supabase; use as a reference |
| simonw/airtable-export | JSON/SQLite snapshot, GitHub Actions backup | No attachments mentioned; last push 2024-04-26 |
