// Table title, view tabs and the "New" button. Server component.
import type { TableDef } from "@/lib/schema/types";
import { NavLink } from "./NavLink";
import { Icon } from "./icons";

const VIEW_ICON = { grid: "grid", kanban: "kanban", calendar: "calendar" } as const;

export function TableHeader({ table, canWrite }: { table: TableDef; canWrite: boolean }) {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{table.label}</h1>
        <span className="spacer" />
        {canWrite ? <a className="btn btn-primary btn-sm" href={`/t/${table.key}/new`}><Icon name="plus" className="nav-icon" />New {(table.singular ?? "record").toLowerCase()}</a> : null}
      </div>
      <nav className="tabs" aria-label="Views">
        {table.views.map((v) => (
          <NavLink key={v.key} className="tab" href={`/t/${table.key}/v/${v.key}`}><Icon name={VIEW_ICON[v.type]} />{v.label}</NavLink>
        ))}
      </nav>
    </>
  );
}
