// Form field view models (with choices for selects, people and links).
import type { FieldDef } from "../schema/types.ts";
import type { Person } from "../data/types.ts";

export interface FormFieldVM { key: string; label: string; type: string; required: boolean; choices?: { value: string; label: string }[]; multiple?: boolean }

export function toFormFields(fields: FieldDef[], people: Person[], links: Record<string, { value: string; label: string }[]>): FormFieldVM[] {
  return fields.map((f) => {
    const vm: FormFieldVM = { key: f.key, label: f.label, type: f.type, required: Boolean(f.required) };
    if (f.type === "select" || f.type === "multiSelect") vm.choices = (f.options ?? []).map((o) => ({ value: o.value, label: o.value }));
    if (f.type === "user") vm.choices = people.map((p) => ({ value: p.id, label: p.name }));
    if (f.type === "link") vm.choices = links[f.key] ?? [];
    if (f.type === "multiSelect" || f.link?.multiple) vm.multiple = true;
    return vm;
  });
}
