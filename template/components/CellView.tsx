// Renders one formatted cell. No hooks: works in server and client components.
import type { Cell } from "@/lib/views/format";

/** `plain` renders links as text, for use inside another link (cards). */
export function CellView({ cell, plain = false }: { cell: Cell; plain?: boolean }) {
  switch (cell.kind) {
    case "empty": return <span className="empty-cell" aria-label="empty"></span>;
    case "text": return <span title={cell.text}>{cell.text}</span>;
    case "number": return <span className="num">{cell.text}</span>;
    case "href": if (plain) return <span>{cell.text}</span>; return <a className="cell-link" href={cell.href} target={cell.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">{cell.text}</a>;
    case "chips": return <span className="chips">{cell.chips.map((c) => <span key={c.label} className={`chip chip-${c.color}`}>{c.label}</span>)}</span>;
    case "records": return <span className="chips">{cell.items.map((r) => plain ? <span key={r.id} className="rec">{r.label}</span> : <a key={r.id} className="rec" href={r.href} title={r.label}>{r.label}</a>)}</span>;
    case "check": return <span className={`check${cell.on ? " on" : ""}`} aria-label={cell.on ? "Yes" : "No"}>{cell.on ? <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5.2l2 2 4-4.4" /></svg> : null}</span>;
    case "user": return <span className="avatar" title={cell.name}><i>{cell.initials}</i><span>{cell.name}</span></span>;
    case "rating": return <span className="stars" aria-label={`${cell.value} of ${cell.max}`}>{"★".repeat(cell.value)}<span className="faint">{"★".repeat(Math.max(0, cell.max - cell.value))}</span></span>;
  }
}
