// Month grid on desktop, agenda list on phones.
import type { CalendarView } from "@/lib/views/board-views";
import { hrefWith, type Params } from "@/lib/views/url";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function Calendar({ vm, base, params }: { vm: CalendarView; base: string; params: Params }) {
  const days = vm.weeks.flat();
  const agenda = days.filter((d) => d.inMonth && d.items.length);
  return (
    <>
      <div className="cal-head">
        <h2>{vm.title}</h2>
        <a className="btn btn-sm" href={hrefWith(base, params, { m: vm.prevMonth })} aria-label="Previous month">‹</a>
        <a className="btn btn-sm" href={hrefWith(base, params, { m: null })}>Today</a>
        <a className="btn btn-sm" href={hrefWith(base, params, { m: vm.nextMonth })} aria-label="Next month">›</a>
      </div>
      <div className="cal" role="grid" aria-label={vm.title}>
        {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {days.map((d) => (
          <div key={d.date} role="gridcell" className={`cal-day${d.inMonth ? "" : " out"}${d.isToday ? " today" : ""}`}>
            <span className="d num">{d.day}</span>
            {d.items.slice(0, 4).map((it) => <a key={it.id} className={`cal-item chip-${it.color}`} href={it.href} title={it.title}>{it.title}</a>)}
            {d.items.length > 4 ? <span className="faint" style={{ fontSize: 11 }}>+{d.items.length - 4} more</span> : null}
          </div>
        ))}
      </div>
      <div className="agenda">
        {agenda.length === 0 ? <div className="panel empty-state">Nothing scheduled this month.</div> : agenda.map((d) => (
          <section key={d.date}>
            <h3>{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}{d.isToday ? " · Today" : ""}</h3>
            <div className="cards" style={{ display: "flex" }}>
              {d.items.map((it) => <a key={it.id} className="card" href={it.href}><span className={`chip chip-${it.color}`} style={{ marginRight: 8 }}>&nbsp;</span>{it.title}</a>)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
