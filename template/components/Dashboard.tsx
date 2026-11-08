import type { DashboardVM } from "@/lib/views/dashboard-view";

export function Dashboard({ vm }: { vm: DashboardVM }) {
  return (
    <>
      <div className="page-head"><h1 className="page-title">{vm.label}</h1></div>
      <div className="content">
        <section className="tiles" aria-label="Key numbers">
          {vm.tiles.map((t) => (
            <a key={t.label} className="tile" href={t.href}>
              <span className="label">{t.label}</span>
              <span className="value">{t.value}</span>
              <span className="sub">{t.sub}</span>
            </a>
          ))}
        </section>
        <section className="charts" aria-label="Charts">
          {vm.charts.map((c) => (
            <figure key={c.label} className="panel chart" style={{ margin: 0 }}>
              <figcaption className="chart-head"><h2>{c.label}</h2><span className="faint num">Total {c.total}</span></figcaption>
              {c.empty ? <p className="faint">No data yet.</p> : (
                <div className="bars" role="table" aria-label={c.label}>
                  {c.bars.map((b) => (
                    <div key={b.label} role="row" style={{ display: "contents" }}>
                      <span className="bar-label" role="rowheader" title={b.label}>{b.label}</span>
                      <span className="bar-track" role="presentation" title={`${b.label}: ${b.display}`}><span className="bar" style={{ width: `${b.pct}%` }} /></span>
                      <span className="bar-value" role="cell">{b.display}</span>
                    </div>
                  ))}
                </div>
              )}
            </figure>
          ))}
        </section>
      </div>
    </>
  );
}
