# app.schema.json in one page

Types: `lib/schema/types.ts`. JSON Schema for editors: `schema/app.schema.v1.json`. Validator (checks every
reference): `npm run schema:check`. Full example: the template's agency CRM (Companies, Contacts, Deals, Tasks).

```jsonc
{
  "version": 1,
  "app": { "name": "Acme CRM", "currency": "USD", "locale": "en-US", "timeZone": "UTC" },
  "tables": [{
    "key": "deals", "label": "Deals", "singular": "Deal", "primaryField": "name",
    "airtable": { "id": "tblXXXX" },
    "fields": [
      { "key": "name", "label": "Deal", "type": "text", "required": true, "airtable": { "id": "fldA" } },
      { "key": "stage", "label": "Stage", "type": "select", "options": [{ "value": "Won", "color": "green" }] },
      { "key": "company", "label": "Company", "type": "link", "link": { "table": "companies", "multiple": false } },
      { "key": "weighted", "label": "Weighted", "type": "formula", "currency": "USD",
        "computed": { "kind": "formula", "expr": "{value} * {probability}", "mode": "generated" } },
      { "key": "company_industry", "label": "Industry", "type": "lookup", "computed": { "kind": "lookup", "via": "company", "field": "industry" } }
    ],
    "views": [
      { "key": "pipeline", "label": "Pipeline", "type": "kanban", "by": "stage", "cardFields": ["company", "value"] },
      { "key": "open", "label": "Open", "type": "grid", "columns": ["name", "stage"], "filters": [{ "field": "stage", "op": "neq", "value": "Won" }], "sorts": [{ "field": "name", "dir": "asc" }] }
    ]
  }],
  "dashboards": [{ "key": "overview", "label": "Overview",
    "tiles": [{ "label": "Open deals", "table": "deals", "metric": "count", "filters": [{ "field": "stage", "op": "neq", "value": "Won" }] }],
    "charts": [{ "label": "Value by stage", "table": "deals", "groupBy": "stage", "metric": "sum", "field": "value" }] }],
  "forms": [{ "key": "enquiry", "label": "Website enquiry", "table": "contacts", "fields": ["name", "email"], "public": true }],
  "roles": [{ "key": "admin", "label": "Admin", "read": "*", "write": "*" }]
}
```

- Field types: text, longText, email, url, phone, number, currency, percent, checkbox, select, multiSelect, date,
  dateTime, rating, link, attachment, user, formula, lookup, rollup, autoNumber, createdTime, updatedTime, json.
- Filter ops: eq, neq, contains, gt, gte, lt, lte, empty, notEmpty, in. Value `"$today"` means today.
  "is not" includes empty cells, like Airtable.
- Rollup: `{ "kind": "rollup", "table": "deals", "linkField": "company", "fn": "sum", "field": "value" }` = sum of
  deals.value where deals.company is this record.
- Chip colours: gray, blue, cyan, teal, green, yellow, orange, red, pink, purple.
- Grids page at 50 rows (`pageSize` up to 500); kanban shows 200 cards per lane and says how many are hidden.
