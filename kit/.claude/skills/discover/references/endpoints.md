# Airtable: what can be read, how, and the limits

Source: Airtable Web API, MCP and support docs, all read 2026-11-08 (research file "Airtable exit bundle",
kb of lowcoding.dev). Labels: **sourced** = in those docs; **assumed** = our judgement, test it.

## Access options
| Option | Reaches | Notes |
|---|---|---|
| Plugin `airtable@claude-plugins-official` (OAuth) | Hosted MCP tools + Airtable's skills | Recommended by Airtable for Claude Code. Owner picks bases. Revoke at `airtable.com/?integrations=thirdParty`. **sourced** |
| Hosted MCP `https://mcp.airtable.com/mcp` with `Authorization: Bearer <PAT>` | Same tools | The same PAT also works for REST. **sourced**. MCP accepting read-only scopes for automation reads: **assumed**, test it |
| REST + PAT | Schema, records, comments, collaborators, views, webhooks | Fastest bulk copy. **sourced** |
| `@airtable/mcp-cli` → `airtable-mcp <tool> --json` (env `AIRTABLE_TOKEN`) | Every MCP tool from scripts | MIT, pushed 2026-08-07; tool names can change between releases. **sourced** |

Read-only scopes: `schema.bases:read`, `data.records:read`, `data.recordComments:read`, `workspacesAndBases:read`,
`user.email:read`; optional `webhook:manage` (also a write scope). **sourced**
Permissions: the MCP respects the user's role; interface-only users see only interfaces. The connecting person
should be a base owner or creator, or automation reads may fail (**assumed**).
Enterprise Scale admins can block MCP or third-party OAuth; the REST API with a PAT is unaffected. **sourced**

## Endpoint map
| Piece | How | Returns | Plan |
|---|---|---|---|
| Who am I | `GET /v0/meta/whoami` | user id, email (with `user.email:read`) | all |
| Bases | `GET /v0/meta/bases` | id, name, `permissionLevel` (none/read/comment/edit/create/interfaceOnly/permissionSetOnly) | all |
| Base + people | `GET /v0/meta/bases/{id}?include=collaborators&include=interfaces&include=inviteLinks` | `workspaceId`; individual and group collaborators (base and workspace level: userId, email, permissionLevel, grantedByUserId); interfaces (id, name, firstPublishTime, own collaborators); open invites | all |
| Workspace people | `GET /v0/meta/workspaces/{id}?include=collaborators` | workspace collaborators + invites | all |
| Tables, fields, views | `GET /v0/meta/bases/{id}/tables?include=visibleFieldIds` | per table: id, name, description, primaryFieldId; fields (id, name, type, options); views (id, name, type; `visibleFieldIds` for grid only) | all |
| Views (flat) | `GET /v0/meta/bases/{id}/views` | id, name, type (grid/form/calendar/gallery/kanban/timeline/block), `personalForUserId` | all |
| Extensions | `GET /v0/meta/bases/{id}/blockInstallations` | id, state, createdByUserId, blockSlug (Airtable-made only) | all |
| Records | `GET /v0/{baseId}/{table}` | id, createdTime, non-empty fields; `returnFieldsByFieldId`, `cellFormat`, `recordMetadata=commentCount`, `filterByFormula`, pageSize ≤ 100 | all |
| Comments | `GET /v0/{baseId}/{table}/{recordId}/comments` | text, author, createdTime, mentions | all |
| Webhooks | `GET /v0/bases/{id}/webhooks` | notificationUrl, specification, expiry, enabled | all; may show only the caller's own hooks (forum report) |
| Automations | MCP `list_automations`, `get_automation` | name, deployment status, trigger, steps with inputs | MCP only (announced 2026-07-24) |
| Interfaces | MCP `list_pages_for_base`, `list_records_for_page`, `get_record_for_page`, `get_form_schema` | pages, page records, form fields and rules | MCP only |
| Connected accounts | MCP `list_external_accounts` | Slack, Google, … linked to the user | MCP only |
| Shares, portal users | `/shares`, `/portalCollaborators` | share links; portal users | Enterprise only |
| Revision history | change events / audit logs | who changed what | Enterprise Scale only |

## Fields: what the schema gives
- Formula: `formula` text with `{fldXXX}` references, `isValid`, `referencedFieldIds`, result type.
- Lookup (`multipleLookupValues`): `recordLinkFieldId`, `fieldIdInLinkedTable`. Rollup: same + `referencedFieldIds`.
  **The rollup aggregation (SUM, ARRAYJOIN…) is not returned.** Lookup filters/sorts/limits are not exposed.
- Link: `linkedTableId`, `inverseLinkFieldId`, `prefersSingleRecordLink`, `isReversed`.
- Selects: choices (id, name, color). Currency: symbol, precision. Rating: max. Dates: format, timeZone.
- AI text: prompt, referenced fields. Synced tables carry an `externalSyncSource` field.
- New field types can appear without notice: log unknown types, never crash.
- View filters, sorts, groups and colours are **not** exposed. Get them from screenshots, or a share link imported
  through NocoDB or Baserow (the only tools that bring them across).

## Limits
- 5 requests/s per base; 50 requests/s for all of one user's PAT traffic; HTTP 429 → wait 30 s.
- Monthly calls per workspace: Free 1,000 (one 30-day grace, then blocked); Team 100,000 (then 2 req/s);
  Business and Enterprise Scale no cap. MCP calls count against these.
- 100 records per page → at most ~500 records/s per base (**derived**).
- Attachment URLs expire 2 hours after the API returns them. Each attachment gives size, type, filename.
- Webhooks made with a PAT expire after 7 days unless refreshed; max 10 per base.
- Automation limits: Team 100 per base / 25k runs per month; Business 150 / 100k. Run history: 6 months (Team),
  1 year (Business), no export documented.
