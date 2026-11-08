import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";
import { loadFormFields } from "@/lib/loaders";
import { RecordForm } from "@/components/RecordForm";
import { createRecordAction } from "@/app/actions";

export default async function NewRecordPage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const s = await requireUser();
  const t = tableOrNull(s.schema, table);
  if (!t || !can(s, t.key, "write")) notFound();
  const data = await loadFormFields(s, t);
  const noun = (t.singular ?? "record").toLowerCase();
  return (
    <>
      <div className="page-head">
        <div><nav className="crumbs" aria-label="Breadcrumb"><a href={`/t/${t.key}`}>{t.label}</a><span aria-hidden="true">/</span><span>New</span></nav>
        <h1 className="page-title">New {noun}</h1></div>
      </div>
      <div className="content form-page">
        {data.notices.map((n) => <div key={n} className="notice">{n}</div>)}
        <RecordForm action={createRecordAction} table={t.key} fields={data.fields} submitLabel={`Create ${noun}`} />
      </div>
    </>
  );
}
