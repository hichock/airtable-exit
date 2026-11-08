// Search, add-filter popover (plain GET form, works without JS) and active filter chips.
import type { FilterChip } from "@/lib/views/grid-view";
import type { TableDef } from "@/lib/schema/types";
import type { Params } from "@/lib/views/url";
import { Icon } from "./icons";

function hidden(params: Params, skip: string[]) {
  return Object.entries(params).flatMap(([k, v]) =>
    skip.includes(k) || v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x, i) => <input key={`${k}${i}`} type="hidden" name={k} value={x} />));
}

export function Toolbar({ table, params, chips, search, count }: { table: TableDef; params: Params; chips: FilterChip[]; search?: string; count?: string }) {
  const filterable = table.fields.filter((f) => !["attachment", "link"].includes(f.type));
  return (
    <div className="toolbar">
      {search !== undefined ? (
        <form role="search">
          {hidden(params, ["q", "p"])}
          <label className="search">
            <Icon name="search" />
            <span className="sr-only">Search {table.label}</span>
            <input type="search" name="q" defaultValue={search} placeholder={`Search ${table.label.toLowerCase()}`} id="grid-search" />
          </label>
        </form>
      ) : null}
      <details className="filter-add">
        <summary className="btn btn-sm"><Icon name="filter" />Filter</summary>
        <form className="popover">
          {hidden(params, ["p", "__field", "__op", "__value"])}
          <div className="row">
            <select className="select" name="__field" aria-label="Field" id="filter-field">
              {filterable.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select className="select" name="__op" aria-label="Condition" id="filter-op" defaultValue="eq">
              <option value="eq">is</option><option value="neq">is not</option><option value="contains">contains</option>
              <option value="gt">greater than</option><option value="lt">less than</option>
              <option value="empty">is empty</option><option value="notEmpty">is not empty</option>
            </select>
          </div>
          <input className="input" name="__value" placeholder="Value" aria-label="Value" id="filter-value" />
          <button className="btn btn-sm btn-primary" type="submit">Add filter</button>
        </form>
      </details>
      {chips.map((c, i) => (
        <span key={i} className={`chip-filter${c.removeHref ? "" : " locked"}`} title={c.removeHref ? undefined : "Part of this view"}>
          {c.label}
          {c.removeHref ? <a href={c.removeHref} aria-label={`Remove filter ${c.label}`}><Icon name="close" className="nav-icon" /></a> : null}
        </span>
      ))}
      {count ? <span className="count num">{count}</span> : null}
    </div>
  );
}
