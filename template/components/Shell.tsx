// App frame: left rail on desktop, a top bar with a menu on phones.
import type { ReactNode } from "react";
import type { AppSchema } from "@/lib/schema/types";
import type { SessionUser } from "@/lib/session";
import type { Mode } from "@/lib/env";
import { canAccess } from "@/lib/access";
import { NavLink } from "./NavLink";
import { Icon } from "./icons";
import { signOutAction } from "@/app/actions";

const VIEW_ICON = { grid: "grid", kanban: "kanban", calendar: "calendar" } as const;

function Nav({ schema, user }: { schema: AppSchema; user: SessionUser | null }) {
  const tables = schema.tables.filter((t) => canAccess(schema, user?.role, t.key, "read"));
  const forms = schema.forms.filter((f) => !f.public && canAccess(schema, user?.role, f.table, "write"));
  return (
    <>
      {schema.dashboards.length ? (
        <div className="nav-group">
          {schema.dashboards.map((d, i) => (
            <NavLink key={d.key} href={i === 0 ? "/" : `/d/${d.key}`} exact={i === 0}><Icon name="dashboard" />{d.label}</NavLink>
          ))}
        </div>
      ) : null}
      <div className="nav-group">
        <div className="nav-label">Tables</div>
        {tables.map((t) => (
          <div key={t.key}>
            <NavLink href={`/t/${t.key}`}><Icon name="table" />{t.label}</NavLink>
            <div className="nav-sub">
              {t.views.map((v) => <NavLink key={v.key} href={`/t/${t.key}/v/${v.key}`}><Icon name={VIEW_ICON[v.type]} />{v.label}</NavLink>)}
            </div>
          </div>
        ))}
      </div>
      {forms.length ? (
        <div className="nav-group">
          <div className="nav-label">Forms</div>
          {forms.map((f) => <NavLink key={f.key} href={`/f/${f.key}`}><Icon name="form" />{f.label}</NavLink>)}
        </div>
      ) : null}
      {user?.role === "admin" ? (
        <div className="nav-group">
          <NavLink href="/system"><Icon name="system" />System</NavLink>
        </div>
      ) : null}
    </>
  );
}

function Foot({ user, mode }: { user: SessionUser | null; mode: Mode }) {
  return (
    <div className="rail-foot">
      {user ? <span>{user.name} · {user.role}</span> : null}
      {mode.kind === "supabase" ? <form action={signOutAction}><button className="linkish" type="submit">Sign out</button></form> : null}
      <span className="studio">Built with airtable-exit by <a href="https://lowcoding.dev" target="_blank" rel="noreferrer">lowcoding.dev</a></span>
    </div>
  );
}

export function Shell({ schema, user, mode, children }: { schema: AppSchema; user: SessionUser | null; mode: Mode; children: ReactNode }) {
  const initial = schema.app.name.slice(0, 1).toUpperCase();
  return (
    <div className="shell">
      <aside className="rail" aria-label="Main">
        <a className="brand" href="/"><span className="brand-mark">{initial}</span>{schema.app.name}</a>
        <Nav schema={schema} user={user} />
        <Foot user={user} mode={mode} />
      </aside>
      <header className="mobile-bar">
        <a className="brand" href="/"><span className="brand-mark">{initial}</span>{schema.app.name}</a>
        <details>
          <summary aria-label="Menu">Menu</summary>
          <nav className="mobile-menu" aria-label="Main">
            <Nav schema={schema} user={user} />
            <Foot user={user} mode={mode} />
          </nav>
        </details>
      </header>
      <div className="main">
        {mode.kind === "demo" ? (
          <div className="banner" role="note">
            {mode.reason === "flag"
              ? <>Demo mode: sample data in memory. Changes reset when the server restarts. Remove <code>DEMO=1</code> to use Supabase.</>
              : <>Supabase is not configured, so this shows sample data. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.</>}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
