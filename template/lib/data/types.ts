import type { FieldDef, Filter, Sort, TableDef } from "../schema/types.ts";

/** A record keyed by field key (not column name). Single links hold an id, multi links an id array. */
export type Row = { id: string; created_at?: string; updated_at?: string; [key: string]: unknown };

export interface Query {
  filters: Filter[];
  sorts: Sort[];
  search?: string;
  page: number;
  pageSize: number;
}

export interface Page {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  /** Things the reader must know, e.g. a filter that could not run on the server. Never hidden. */
  notices: string[];
}

export interface Person {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Actor {
  id: string;
  name: string;
}

export interface CommentItem {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

export interface AttachmentItem {
  id: string;
  field: string;
  filename: string;
  mime?: string;
  size?: number;
  url?: string;
}

export interface RunItem {
  id: string;
  name: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  detail?: string;
  error?: string;
}

export interface Store {
  mode: "demo" | "supabase";
  list(t: TableDef, q: Query): Promise<Page>;
  /** Every row matching the filters, paged under the hood (Supabase returns at most 1,000 per request). */
  all(t: TableDef, filters: Filter[]): Promise<Row[]>;
  get(t: TableDef, id: string): Promise<Row | null>;
  byIds(t: TableDef, ids: string[]): Promise<Row[]>;
  /** Rows of `src` whose link field points at any of `ids`. */
  linking(src: TableDef, linkField: FieldDef, ids: string[]): Promise<Row[]>;
  people(): Promise<Person[]>;
  update(t: TableDef, id: string, patch: Record<string, unknown>, actor: Actor): Promise<void>;
  create(t: TableDef, values: Record<string, unknown>, actor: Actor | null): Promise<string>;
  comments(t: TableDef, id: string): Promise<CommentItem[]>;
  addComment(t: TableDef, id: string, body: string, actor: Actor): Promise<void>;
  activity(t: TableDef, id: string): Promise<ActivityItem[]>;
  attachments(t: TableDef, id: string): Promise<AttachmentItem[]>;
  runs(): Promise<{ automations: RunItem[]; syncs: RunItem[] }>;
}
