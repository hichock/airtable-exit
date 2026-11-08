// Types for app.schema.json. The schema-designer skill writes that file; the runtime renders from it.
// One source of truth: the JSON Schema in schema/app.schema.v1.json mirrors these types.

export type FieldType =
  | "text"
  | "longText"
  | "email"
  | "url"
  | "phone"
  | "number"
  | "currency"
  | "percent"
  | "checkbox"
  | "select"
  | "multiSelect"
  | "date"
  | "dateTime"
  | "rating"
  | "link"
  | "attachment"
  | "user"
  | "formula"
  | "lookup"
  | "rollup"
  | "autoNumber"
  | "createdTime"
  | "updatedTime"
  | "json";

export type ChipColor = "gray" | "blue" | "cyan" | "teal" | "green" | "yellow" | "orange" | "red" | "pink" | "purple";

export interface SelectOption {
  value: string;
  color?: ChipColor;
}

export interface AirtableRef {
  id: string;
  type?: string;
}

export interface LinkSpec {
  table: string;
  multiple: boolean;
}

export type RollupFn = "sum" | "count" | "avg" | "min" | "max";

/** A formula, written in Airtable syntax with {field_key} references. */
export interface FormulaSpec {
  kind: "formula";
  expr: string;
  /** generated = Postgres generated column; app = computed in TypeScript at read time. */
  mode: "generated" | "app";
  note?: string;
}

/** Value of `field` on the record(s) linked through this table's own link field `via`. */
export interface LookupSpec {
  kind: "lookup";
  via: string;
  field: string;
}

/** Aggregate over rows of `table` whose link field `linkField` points at this record. */
export interface RollupSpec {
  kind: "rollup";
  table: string;
  linkField: string;
  fn: RollupFn;
  field?: string;
  note?: string;
}

export type ComputedSpec = FormulaSpec | LookupSpec | RollupSpec;

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  options?: SelectOption[];
  precision?: number;
  currency?: string;
  max?: number;
  link?: LinkSpec;
  computed?: ComputedSpec;
  airtable?: AirtableRef;
}

export type FilterOp = "eq" | "neq" | "contains" | "gt" | "gte" | "lt" | "lte" | "empty" | "notEmpty" | "in";
export type FilterValue = string | number | boolean | string[];

export interface Filter {
  field: string;
  op: FilterOp;
  value?: FilterValue;
}

export interface Sort {
  field: string;
  dir: "asc" | "desc";
}

export type ViewType = "grid" | "kanban" | "calendar";

export interface ViewDef {
  key: string;
  label: string;
  type: ViewType;
  columns?: string[];
  filters?: Filter[];
  sorts?: Sort[];
  groupBy?: string;
  /** kanban: the select field that makes the columns. calendar: the date field. */
  by?: string;
  cardFields?: string[];
  pageSize?: number;
  airtable?: AirtableRef;
}

export interface TableDef {
  key: string;
  label: string;
  singular?: string;
  primaryField: string;
  description?: string;
  fields: FieldDef[];
  views: ViewDef[];
  airtable?: AirtableRef;
}

export interface FormDef {
  key: string;
  label: string;
  table: string;
  fields: string[];
  public?: boolean;
  intro?: string;
  submitLabel?: string;
}

export interface TileDef {
  label: string;
  table: string;
  metric: "count" | "sum" | "avg";
  field?: string;
  filters?: Filter[];
}

export interface ChartDef {
  label: string;
  table: string;
  groupBy: string;
  metric: "count" | "sum";
  field?: string;
  filters?: Filter[];
}

export interface DashboardDef {
  key: string;
  label: string;
  tiles: TileDef[];
  charts: ChartDef[];
}

export type Access = "*" | string[];

export interface RoleDef {
  key: string;
  label: string;
  read: Access;
  write: Access;
}

export interface AppSchema {
  $schema?: string;
  version: 1;
  app: { name: string; currency?: string; locale?: string; timeZone?: string };
  tables: TableDef[];
  dashboards: DashboardDef[];
  forms: FormDef[];
  roles: RoleDef[];
}

export const COMPUTED_TYPES: readonly FieldType[] = [
  "formula",
  "lookup",
  "rollup",
  "autoNumber",
  "createdTime",
  "updatedTime",
];

export function isComputed(f: FieldDef): boolean {
  return COMPUTED_TYPES.includes(f.type);
}

/** Fields a person can type into (grid inline edit, forms). */
export const EDITABLE_TYPES: readonly FieldType[] = [
  "text",
  "longText",
  "email",
  "url",
  "phone",
  "number",
  "currency",
  "percent",
  "checkbox",
  "select",
  "multiSelect",
  "date",
  "dateTime",
  "rating",
  "link",
];

export function isEditable(f: FieldDef): boolean {
  return EDITABLE_TYPES.includes(f.type);
}
