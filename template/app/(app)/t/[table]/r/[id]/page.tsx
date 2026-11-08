import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";
import { loadRecord } from "@/lib/loaders";
import { FieldEditor } from "@/components/FieldEditor";
import { addCommentAction } from "@/app/actions";
import type { RecordVM } from "@/lib/views/record-view";

type Props = { params: Promise<{ table: string; id: string }> };

function Backlinks({ vm }: { vm: RecordVM }) {
  return vm.backlinks.map((g) => (
    <section key={`${g.table}.${g.via}`} className="panel">
      <div className="panel-head">{g.tableLabel}<span className="faint">{g.total} via {g.via}</span></div>
      <div className="panel-body">
        {g.rows.length === 0 ? <p className="faint">None yet.</p> : g.rows.map((r) => (
          <div key={r.id} className="backlink"><a href={r.href} title={r.title}>{r.title}</a><span>{r.summary}</span></div>
        ))}
        {g.total > g.rows.length ? <p className="faint">Showing {g.rows.length} of {g.total}. <a className="cell-link" href={`/t/${g.table}`}>Open {g.tableLabel}</a></p> : null}
      </div>
    </section>
  ));
}

function Files({ vm }: { vm: RecordVM }) {
  if (!vm.files.length) return null;
  return (
    <section className="panel">
      <div className="panel-head">Files<span className="faint">{vm.files.length}</span></div>
      <div className="panel-body">
        {vm.files.map((f) => (
          <div key={f.id} className="file">
            <span className="file-ext">{f.filename.split(".").pop()?.slice(0, 4)}</span>
            <div>
              {f.url ? <a href={f.url} target="_blank" rel="noreferrer"><b>{f.filename}</b></a> : <b>{f.filename}</b>}
              <span className="faint">{f.fieldLabel} · {f.sizeText}{f.url ? "" : " · demo file"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function RecordPage({ params }: Props) {
  const { table, id } = await params;
  const s = await requireUser();
  const t = tableOrNull(s.schema, table);
  if (!t || !can(s, t.key, "read")) notFound();
  const data = await loadRecord(s, t, id);
  if (!data) notFound();
  const { vm } = data;
  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <nav className="crumbs" aria-label="Breadcrumb"><a href={`/t/${t.key}`}>{vm.tableLabel}</a><span aria-hidden="true">/</span><span>{vm.singular}</span></nav>
          <h1 className="page-title">{vm.title}</h1>
        </div>
      </div>
      <div className="content">
        {data.notices.map((n) => <div key={n} className="notice">{n}</div>)}
        <div className="record">
          <div className="side" style={{ minWidth: 0 }}>
            <section className="panel">
              <div className="panel-head">Details{data.canWrite ? <span className="faint">Click a value to edit</span> : <span className="faint">Read only</span>}</div>
              <div className="panel-body">
                <dl className="fields">
                  {vm.fields.map((f) => (
                    <div key={f.key} style={{ display: "contents" }}>
                      <dt>{f.label}{f.computedNote ? <small>{f.computedNote}</small> : null}</dt>
                      <dd><FieldEditor table={t.key} recordId={id} field={f} people={data.people} links={data.linkChoices[f.key] ?? []} /></dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
            <Backlinks vm={vm} />
          </div>
          <div className="side">
            <Files vm={vm} />
            <section className="panel">
              <div className="panel-head">Comments<span className="faint">{vm.comments.length}</span></div>
              <div className="panel-body">
                {vm.comments.map((c) => (
                  <div key={c.id} className="comment">
                    <div className="comment-head"><b>{c.author}</b><time className="faint">{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></div>
                    <p>{c.body}</p>
                  </div>
                ))}
                <form action={addCommentAction} className="comment-form">
                  <input type="hidden" name="table" value={t.key} />
                  <input type="hidden" name="id" value={id} />
                  <label className="sr-only" htmlFor="comment-body">Add a comment</label>
                  <textarea id="comment-body" name="body" className="textarea" placeholder="Add a comment" required maxLength={10000} />
                  <button className="btn btn-sm" type="submit">Comment</button>
                </form>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">Activity</div>
              <div className="panel-body">
                {vm.activity.length === 0 ? <p className="faint">No changes recorded yet.</p> : (
                  <ul className="timeline">
                    {vm.activity.map((a) => <li key={a.id}><b>{a.actor}</b> {a.text}<time>{a.when}</time></li>)}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
