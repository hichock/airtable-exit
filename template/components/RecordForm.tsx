"use client";
// Create-record form (internal or public). Server action validates; errors show per field.

import { useActionState } from "react";
import type { FormState } from "@/lib/views/forms";
import type { Choice } from "./FieldEditor";

export interface FormFieldVM {
  key: string;
  label: string;
  type: string;
  required: boolean;
  choices?: Choice[];
  multiple?: boolean;
}

type Action = (prev: FormState, data: FormData) => Promise<FormState>;

function Control({ f }: { f: FormFieldVM }) {
  const id = `form-${f.key}`;
  if (f.choices && f.multiple) {
    return (
      <div className="multi" role="group" aria-labelledby={`${id}-label`}>
        {f.choices.map((c) => <label key={c.value}><input type="checkbox" name={f.key} value={c.value} /> {c.label}</label>)}
      </div>
    );
  }
  if (f.choices) {
    return (
      <select id={id} name={f.key} className="select" defaultValue="">
        <option value="">—</option>
        {f.choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  }
  if (f.type === "checkbox") return <input id={id} name={f.key} type="checkbox" style={{ width: 18, height: 18 }} />;
  if (f.type === "longText") return <textarea id={id} name={f.key} className="textarea" />;
  const type = f.type === "date" ? "date" : f.type === "dateTime" ? "datetime-local" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text";
  const mode = ["number", "currency", "percent", "rating"].includes(f.type) ? "decimal" : undefined;
  return <input id={id} name={f.key} className="input" type={type} inputMode={mode} required={f.required} />;
}

export function RecordForm({ action, table, form, fields, submitLabel }: { action: Action; table: string; form?: string; fields: FormFieldVM[]; submitLabel: string }) {
  const [state, run, pending] = useActionState(action, { ok: false, errors: {} });
  if (state.ok && state.message) return <div className="success" role="status">{state.message}</div>;
  return (
    <form action={run} className="panel" noValidate>
      <input type="hidden" name="__table" value={table} />
      {form ? <input type="hidden" name="__form" value={form} /> : null}
      <div className="form-grid">
        {fields.map((f) => (
          <div className="form-row" key={f.key}>
            <label id={`form-${f.key}-label`} htmlFor={`form-${f.key}`}>{f.label}{f.required ? <span className="req"> *</span> : null}</label>
            <Control f={f} />
            {state.errors[f.key] ? <div className="field-error" role="alert">{state.errors[f.key]}</div> : null}
          </div>
        ))}
      </div>
      <div className="form-actions">
        {state.message ? <span className="msg" role="status">{state.message}</span> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
