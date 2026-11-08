"use client";
// One editable field on the record page. Click to edit; Save writes at once and logs activity.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FieldVM } from "@/lib/views/record-view";
import type { Person } from "@/lib/data/types";
import { CellView } from "./CellView";
import { updateFieldAction } from "@/app/actions";

export interface Choice { value: string; label: string }

function initial(f: FieldVM): string | string[] {
  if (Array.isArray(f.raw)) return f.raw.map(String);
  if (f.raw === null || f.raw === undefined) return f.multiple || f.type === "multiSelect" ? [] : "";
  if (f.type === "percent") return String(Math.round(Number(f.raw) * 10000) / 100);
  if (f.type === "dateTime") return String(f.raw).slice(0, 16);
  return String(f.raw);
}

function choicesFor(f: FieldVM, people: Person[], links: Choice[]): Choice[] | null {
  if (f.type === "select" || f.type === "multiSelect") return (f.options ?? []).map((o) => ({ value: o.value, label: o.value }));
  if (f.type === "user") return people.map((p) => ({ value: p.id, label: p.name }));
  if (f.type === "link") return links;
  return null;
}

function Input({ f, value, set, choices }: { f: FieldVM; value: string | string[]; set: (v: string | string[]) => void; choices: Choice[] | null }) {
  const id = `fld-${f.key}`;
  if (choices && Array.isArray(value)) {
    return (
      <div className="multi" role="group" aria-label={f.label}>
        {choices.map((c) => (
          <label key={c.value}>
            <input type="checkbox" checked={value.includes(c.value)} onChange={(e) => set(e.target.checked ? [...value, c.value] : value.filter((x) => x !== c.value))} />
            {c.label}
          </label>
        ))}
      </div>
    );
  }
  if (choices) {
    return (
      <select id={id} className="select" value={String(value)} onChange={(e) => set(e.target.value)} autoFocus aria-label={f.label}>
        <option value="">—</option>
        {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    );
  }
  if (f.type === "longText") return <textarea id={id} className="textarea" value={String(value)} onChange={(e) => set(e.target.value)} autoFocus aria-label={f.label} />;
  const type = f.type === "date" ? "date" : f.type === "dateTime" ? "datetime-local" : f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text";
  return <input id={id} className="input" type={type} value={String(value)} onChange={(e) => set(e.target.value)} autoFocus aria-label={f.label} />;
}

export function FieldEditor({ table, recordId, field, people, links = [] }: { table: string; recordId: string; field: FieldVM; people: Person[]; links?: Choice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | string[]>(initial(field));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (v: unknown) => start(async () => {
    const r = await updateFieldAction(table, recordId, field.key, v);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setOpen(false);
    router.refresh();
  });

  if (!field.editable) return <CellView cell={field.cell} />;

  if (field.type === "checkbox") {
    return (
      <label className="field-edit" style={{ cursor: "pointer" }}>
        <input type="checkbox" checked={field.raw === true} disabled={pending} onChange={(e) => submit(e.target.checked)} />
        <span className="muted">{field.raw === true ? "Yes" : "No"}</span>
      </label>
    );
  }

  if (!open) {
    return (
      <button type="button" className="field-edit" onClick={() => { setValue(initial(field)); setOpen(true); }} aria-label={`Edit ${field.label}`}>
        {field.cell.kind === "empty" ? <span className="faint">Add {field.label.toLowerCase()}</span> : <CellView cell={field.cell} plain />}
      </button>
    );
  }

  return (
    <form className="field-form" onSubmit={(e) => { e.preventDefault(); submit(value); }} onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <Input f={field} value={value} set={setValue} choices={choicesFor(field, people, links)} />
      <button className="btn btn-sm btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      <button className="btn btn-sm" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {error ? <div className="field-error" role="alert">{error}</div> : null}
    </form>
  );
}
