import { notFound } from "next/navigation";
import { requireUser, can } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";
import { loadFormFields } from "@/lib/loaders";
import { RecordForm } from "@/components/RecordForm";
import { createRecordAction } from "@/app/actions";

export default async function InternalFormPage({ params }: { params: Promise<{ form: string }> }) {
  const { form: key } = await params;
  const s = await requireUser();
  const form = s.schema.forms.find((f) => f.key === key);
  const t = form ? tableOrNull(s.schema, form.table) : null;
  if (!form || !t || !can(s, t.key, "write")) notFound();
  const data = await loadFormFields(s, t, form);
  return (
    <>
      <div className="page-head"><h1 className="page-title">{form.label}</h1></div>
      <div className="content form-page">
        {form.intro ? <p className="muted" style={{ margin: 0 }}>{form.intro}</p> : null}
        {data.notices.map((n) => <div key={n} className="notice">{n}</div>)}
        <RecordForm action={createRecordAction} table={t.key} form={form.key} fields={data.fields} submitLabel={form.submitLabel ?? "Save"} />
      </div>
    </>
  );
}
