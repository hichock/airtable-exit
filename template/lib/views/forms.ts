// Form submissions → typed values or per-field errors. Pure.
import type { FieldDef, FormDef, TableDef } from "../schema/types.ts";
import { isEditable } from "../schema/types.ts";
import { findField } from "../schema/naming.ts";
import { parseInput } from "./parse-input.ts";

export interface FormState {
  ok: boolean;
  errors: Record<string, string>;
  message?: string;
  id?: string;
}

export const EMPTY_FORM: FormState = { ok: false, errors: {} };

/** Fields a form shows: the form's own list, or every editable field of the table. */
export function formFields(t: TableDef, form?: FormDef): FieldDef[] {
  if (form) return form.fields.map((k) => findField(t, k)).filter((f): f is FieldDef => Boolean(f));
  return t.fields.filter(isEditable);
}

type Getter = { get(k: string): unknown; getAll(k: string): unknown[] };

export function collectValues(fields: FieldDef[], data: Getter): { values: Record<string, unknown>; errors: Record<string, string> } {
  const values: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const many = f.type === "multiSelect" || (f.type === "link" && f.link?.multiple);
    const raw = many ? data.getAll(f.key) : f.type === "checkbox" ? data.get(f.key) === "on" : data.get(f.key);
    const r = parseInput(f, raw);
    if (r.ok) values[f.key] = r.value;
    else errors[f.key] = r.error;
  }
  return { values, errors };
}
