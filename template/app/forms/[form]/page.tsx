// Public form: no login, outside the app shell. Only forms marked "public" in app.schema.json.
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";
import { formFields } from "@/lib/views/forms";
import { toFormFields } from "@/lib/views/form-fields";
import { RecordForm } from "@/components/RecordForm";
import { submitPublicFormAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PublicFormPage({ params }: { params: Promise<{ form: string }> }) {
  const { form: key } = await params;
  const s = await getSession();
  const form = s.schema.forms.find((f) => f.key === key && f.public);
  const t = form ? tableOrNull(s.schema, form.table) : null;
  if (!form || !t) notFound();
  // Public forms never list people or linked records.
  const fields = toFormFields(formFields(t, form).filter((f) => f.type !== "link" && f.type !== "user"), [], {});
  return (
    <main className="auth">
      <div className="auth-card" style={{ width: "min(560px, 100%)" }}>
        <span className="brand-mark" aria-hidden="true">{s.schema.app.name.slice(0, 1)}</span>
        <h1>{form.label}</h1>
        {form.intro ? <p className="muted">{form.intro}</p> : null}
        <RecordForm action={submitPublicFormAction} table={t.key} form={form.key} fields={fields} submitLabel={form.submitLabel ?? "Send"} />
        <p className="public-foot">{s.schema.app.name}</p>
      </div>
    </main>
  );
}
