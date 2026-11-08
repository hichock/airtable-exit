"use client";
// Grid with a sticky header, sticky primary column and inline edit for simple fields.
// Double-click or Enter edits a cell; Enter/blur saves, Escape cancels. Phones get cards instead.

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { GridView, Column } from "@/lib/views/grid-view";
import type { Person } from "@/lib/data/types";
import { CellView } from "./CellView";
import { updateFieldAction } from "@/app/actions";

type Editing = { row: string; col: string } | null;

function widthClass(c: Column): string {
  if (c.primary) return "col-w-primary";
  if (["link", "email", "url", "longText", "multiSelect", "lookup"].includes(c.type)) return "col-w-wide";
  if (["checkbox", "rating", "percent", "number"].includes(c.type)) return "col-w-narrow";
  return "col-w-mid";
}

function Editor({ col, value, people, onSave, onCancel }: { col: Column; value: unknown; people: Person[]; onSave: (v: unknown) => void; onCancel: () => void }) {
  const [v, setV] = useState(value === null || value === undefined ? "" : col.type === "percent" ? String(Math.round(Number(value) * 10000) / 100) : String(value));
  const keys = (e: KeyboardEvent) => {
    if (e.key === "Enter") onSave(v);
    if (e.key === "Escape") onCancel();
  };
  if (col.type === "select" || col.type === "user") {
    const opts = col.type === "select" ? (col.options ?? []).map((o) => ({ value: o.value, label: o.value })) : people.map((p) => ({ value: p.id, label: p.name }));
    return (
      <select className="select" autoFocus value={v} onChange={(e) => onSave(e.target.value)} onBlur={onCancel} onKeyDown={keys} aria-label={col.label}>
        <option value="">—</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  const type = col.type === "date" ? "date" : ["number", "currency", "percent", "rating"].includes(col.type) ? "text" : col.type === "email" ? "email" : "text";
  return <input className="input" autoFocus type={type} inputMode={type === "text" && col.type !== "text" ? "decimal" : undefined} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onSave(v)} onKeyDown={keys} aria-label={col.label} />;
}

export function GridTable({ table, vm, people }: { table: string; vm: GridView; people: Person[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const save = (rowId: string, col: Column, before: unknown, value: unknown) => {
    setEditing(null);
    if (String(before ?? "") === String(value ?? "")) return;
    setSaving(`${rowId}:${col.key}`);
    start(async () => {
      const r = await updateFieldAction(table, rowId, col.key, value);
      setSaving(null);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  const toggle = (rowId: string, col: Column, before: unknown) => save(rowId, col, before, !(before === true));

  if (vm.rows.length === 0) return <div className="panel empty-state">No records match this view.</div>;

  const cardCols = vm.columns.filter((c) => !c.primary).slice(0, 4);

  return (
    <>
      <div className="grid-wrap" role="region" aria-label="Records" tabIndex={0}>
        <table className="grid">
          <colgroup>
            <col style={{ width: 46 }} />
            {vm.columns.map((c) => <col key={c.key} className={widthClass(c)} />)}
          </colgroup>
          <thead>
            <tr>
              <th className="idx" scope="col"><span className="sr-only">Row</span></th>
              {vm.columns.map((c) => (
                <th key={c.key} scope="col" className={`${c.primary ? "primary " : ""}${c.align}`} aria-sort={c.sort === "asc" ? "ascending" : c.sort === "desc" ? "descending" : "none"}>
                  <a href={c.sortHref} title={`Sort by ${c.label}`}>
                    <span>{c.label}</span>
                    {c.sort ? <span className="sort">{c.sort === "asc" ? "▲" : "▼"}</span> : null}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vm.rows.map((r, ri) => (
              <tr key={r.id}>
                <td className="idx num">{(vm.pager.from || 1) + ri}</td>
                {vm.columns.map((c, ci) => {
                  const cell = r.cells[ci]!;
                  const isEditing = editing?.row === r.id && editing.col === c.key;
                  const cls = [c.primary ? "primary" : "", c.align, c.editable ? "editable" : "", isEditing ? "editing" : "", saving === `${r.id}:${c.key}` ? "saving" : ""].filter(Boolean).join(" ");
                  if (c.primary && !isEditing) {
                    return (
                      <td key={c.key} className={cls} onDoubleClick={() => c.editable && setEditing({ row: r.id, col: c.key })}>
                        <a href={r.href} title={r.title}>{r.title}</a>
                      </td>
                    );
                  }
                  if (isEditing) {
                    return (
                      <td key={c.key} className={cls}>
                        <Editor col={c} value={r.raw[c.key]} people={people} onSave={(v) => save(r.id, c, r.raw[c.key], v)} onCancel={() => setEditing(null)} />
                      </td>
                    );
                  }
                  const open = () => (c.type === "checkbox" ? toggle(r.id, c, r.raw[c.key]) : setEditing({ row: r.id, col: c.key }));
                  return (
                    <td
                      key={c.key}
                      className={cls}
                      tabIndex={c.editable ? 0 : undefined}
                      onDoubleClick={c.editable ? open : undefined}
                      onKeyDown={c.editable ? (e) => e.key === "Enter" && open() : undefined}
                      onClick={c.editable && c.type === "checkbox" ? open : undefined}
                    >
                      <CellView cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cards">
        {vm.rows.map((r) => (
          <a key={r.id} className="card" href={r.href}>
            <div className="card-title">{r.title}</div>
            <dl className="card-meta">
              {cardCols.map((c) => {
                const cell = r.cells[vm.columns.indexOf(c)]!;
                return cell.kind === "empty" ? null : (
                  <div key={c.key} style={{ display: "contents" }}>
                    <dt>{c.label}</dt>
                    <dd><CellView cell={cell} plain /></dd>
                  </div>
                );
              })}
            </dl>
          </a>
        ))}
      </div>

      {error ? (
        <div className="toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      ) : null}
    </>
  );
}
