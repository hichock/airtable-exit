// Admin page: people and roles, automation runs, sync runs. The weekly health skill reads the same tables.
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { InviteForm } from "@/components/InviteForm";
import type { RunItem } from "@/lib/data/types";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

function Runs({ title, runs, empty }: { title: string; runs: RunItem[]; empty: string }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}<span className="faint">last {runs.length}</span></div>
      {runs.length === 0 ? <p className="panel-body faint">{empty}</p> : (
        <div className="table-scroll">
          <table className="simple">
            <thead><tr><th>Job</th><th>Status</th><th>Started</th><th>Result</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><span className={`status-${r.status}`}>{r.status}</span></td>
                  <td className="num">{when(r.startedAt)}</td>
                  <td className="wrap">{r.error ?? r.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function SystemPage() {
  const s = await requireUser();
  if (s.user.role !== "admin") notFound();
  const [people, runs] = await Promise.all([s.store.people(), s.store.runs()]);
  return (
    <>
      <div className="page-head"><h1 className="page-title">System</h1></div>
      <div className="content">
        <section className="panel">
          <div className="panel-head">People<span className="faint">{people.length}</span></div>
          <InviteForm roles={s.schema.roles.map((r) => ({ key: r.key, label: r.label }))} />
          <div className="table-scroll">
            <table className="simple">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
              <tbody>{people.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.email}</td><td>{s.schema.roles.find((r) => r.key === p.role)?.label ?? p.role}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <Runs title="Automation runs" runs={runs.automations} empty="No automation has run yet." />
        <Runs title="Sync with Airtable" runs={runs.syncs} empty="No sync has run yet." />
      </div>
    </>
  );
}
