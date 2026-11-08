# Usage signals (what the agent can compute alone)

Source: Airtable Web API docs read 2026-11-08 (**sourced**); rules marked **assumed** are our judgement.

| Signal | How | Label |
|---|---|---|
| Record count | Page with `fields[]=<primary>`; 1 call per 100 records | sourced (page size), derived (cost) |
| Fill rate per field | Empty fields are omitted from records, so count presence | sourced |
| Freshness | min/max/30-day count of `createdTime` (on every record) | sourced |
| Recent edits | `filterByFormula=IS_AFTER(LAST_MODIFIED_TIME(),'<date>')` per table | assumed (Airtable formula function; test it) |
| Dead field | fill < 5% AND not in any `referencedFieldIds` AND not in any grid `visibleFieldIds` AND not used by an automation | assumed |
| Stale table | no records created or modified in 90 days and no automation reads it | assumed |
| Data quality | duplicate primary values, emails/phones in text fields, numbers as text, mixed types (`cellFormat=string` vs json), `isValid=false` formulas, links pointing at deleted records | assumed |
| Comments | fetch only where `recordMetadata=commentCount` > 0 | sourced (param), assumed (tactic) |
| Who works where | `createdBy`, `lastModifiedBy`, collaborator cells, comment authors | sourced (formats), assumed (use) |
| Personal working views | `personalForUserId` on views | sourced |
| Seats vs activity | editors with zero records created/modified in 90 days = seats to cut | assumed |

Revision history is Enterprise-only (change events, 14 days). Snapshots are UI-only. So the migration moves the
current state and comments, not history. Say so in the report. **sourced + assumed**
