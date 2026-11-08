import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/session";
import { tableOrNull, viewOrNull } from "@/lib/schema/load";
import { loadView } from "@/lib/loaders";
import { hrefWith, type Params } from "@/lib/views/url";
import { filterChips } from "@/lib/views/grid-view";
import { TableHeader } from "@/components/TableHeader";
import { Toolbar } from "@/components/Toolbar";
import { GridTable } from "@/components/GridTable";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Calendar } from "@/components/Calendar";

type Props = { params: Promise<{ table: string; view: string }>; searchParams: Promise<Params> };

/** The add-filter form posts __field/__op/__value; fold them into one f= param and redirect. */
function foldFilter(base: string, sp: Params): string | null {
  if (typeof sp.__field !== "string" || typeof sp.__op !== "string") return null;
  const f = `${sp.__field}:${sp.__op}${["empty", "notEmpty"].includes(sp.__op) ? "" : `:${String(sp.__value ?? "")}`}`;
  const existing = sp.f === undefined ? [] : Array.isArray(sp.f) ? sp.f : [sp.f];
  return hrefWith(base, { ...sp, __field: undefined, __op: undefined, __value: undefined }, { f: [...existing, f] });
}

export default async function ViewPage({ params, searchParams }: Props) {
  const [{ table, view }, sp] = await Promise.all([params, searchParams]);
  const s = await requireUser();
  const t = tableOrNull(s.schema, table);
  const v = t ? viewOrNull(t, view) : null;
  if (!t || !v || !can(s, t.key, "read")) notFound();
  const base = `/t/${t.key}/v/${v.key}`;
  const folded = foldFilter(base, sp);
  if (folded) redirect(folded);
  const data = await loadView(s, t, v, sp, base);
  const canWrite = can(s, t.key, "write");
  const chips = filterChips(t, v, base, sp);
  return (
    <>
      <TableHeader table={t} canWrite={canWrite} />
      <div className="content">
        {data.type === "grid" ? (
          <>
            <Toolbar table={t} params={sp} chips={chips} search={data.vm.search} count={`${data.vm.pager.total.toLocaleString("en-US")} ${data.vm.pager.total === 1 ? "record" : "records"}`} />
            {data.vm.notices.map((n) => <div key={n} className="notice">{n}</div>)}
            <GridTable table={t.key} vm={data.vm} people={data.people} />
            {data.vm.pager.pages > 1 ? (
              <nav className="pager" aria-label="Pages">
                <span className="num">{data.vm.pager.from}–{data.vm.pager.to} of {data.vm.pager.total.toLocaleString("en-US")}</span>
                {data.vm.pager.prevHref ? <a className="btn btn-sm" href={data.vm.pager.prevHref}>Previous</a> : <button className="btn btn-sm" disabled>Previous</button>}
                {data.vm.pager.nextHref ? <a className="btn btn-sm" href={data.vm.pager.nextHref}>Next</a> : <button className="btn btn-sm" disabled>Next</button>}
              </nav>
            ) : null}
          </>
        ) : null}
        {data.type === "kanban" ? (
          <>
            <Toolbar table={t} params={sp} chips={chips} count={`${data.vm.columns.reduce((a, c) => a + c.count, 0)} records`} />
            <KanbanBoard key={data.vm.columns.map((c) => c.count).join("-")} table={t.key} vm={data.vm} canWrite={canWrite} />
          </>
        ) : null}
        {data.type === "calendar" ? (
          <>
            <Toolbar table={t} params={sp} chips={chips} />
            <Calendar vm={data.vm} base={base} params={sp} />
          </>
        ) : null}
      </div>
    </>
  );
}
