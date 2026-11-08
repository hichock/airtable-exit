"use client";
// Kanban: drag a card to another lane to change the select field. Saves at once, rolls back on error.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { KanbanView, Card } from "@/lib/views/board-views";
import { CellView } from "./CellView";
import { updateFieldAction } from "@/app/actions";

export function KanbanBoard({ table, vm, canWrite }: { table: string; vm: KanbanView; canWrite: boolean }) {
  const router = useRouter();
  const [lanes, setLanes] = useState(vm.columns);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const move = (cardId: string, to: string | null) => {
    const from = lanes.find((l) => l.cards.some((c) => c.id === cardId));
    if (!from || from.value === to) return;
    const card = from.cards.find((c) => c.id === cardId) as Card;
    const before = lanes;
    setLanes(lanes.map((l) =>
      l.value === from.value ? { ...l, cards: l.cards.filter((c) => c.id !== cardId), count: l.count - 1 }
      : l.value === to ? { ...l, cards: [card, ...l.cards], count: l.count + 1 } : l));
    start(async () => {
      const r = await updateFieldAction(table, cardId, vm.field, to ?? "");
      if (!r.ok) { setLanes(before); setError(r.error); }
      router.refresh();
    });
  };

  return (
    <>
      <div className="board">
        {lanes.map((lane) => {
          const key = lane.value ?? "__none";
          return (
            <section
              key={key}
              className={`lane${over === key ? " drop" : ""}`}
              aria-label={lane.label}
              onDragOver={canWrite ? (e) => { e.preventDefault(); setOver(key); } : undefined}
              onDragLeave={() => setOver(null)}
              onDrop={canWrite ? (e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, lane.value); } : undefined}
            >
              <header className="lane-head">
                <span className={`chip chip-${lane.color}`}>{lane.label}</span>
                <span className="faint num">{lane.count}</span>
              </header>
              <div className="lane-body">
                {lane.cards.map((c) => (
                  <article
                    key={c.id}
                    className={`kcard${dragging === c.id ? " dragging" : ""}`}
                    draggable={canWrite}
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDragging(c.id); }}
                    onDragEnd={() => setDragging(null)}
                  >
                    <a className="kcard-title" href={c.href}>{c.title}</a>
                    {c.meta.length ? (
                      <div className="meta">
                        {c.meta.map((m) => <span key={m.label} title={m.label}><CellView cell={m.cell} /></span>)}
                      </div>
                    ) : null}
                  </article>
                ))}
                {lane.hidden > 0 ? <div className="lane-more">{lane.hidden} more not shown. Use the grid to see all.</div> : null}
                {lane.cards.length === 0 ? <div className="lane-more">Nothing here</div> : null}
              </div>
            </section>
          );
        })}
      </div>
      {error ? (
        <div className="toast" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss">×</button></div>
      ) : null}
    </>
  );
}
