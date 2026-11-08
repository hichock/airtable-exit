"use server";
// Server actions: parse → load → decide → write → message. Access is checked here and again by RLS.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, getSession, requireUser } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";
import { findField } from "@/lib/schema/naming";
import { parseInput } from "@/lib/views/parse-input";
import { collectValues, formFields, type FormState } from "@/lib/views/forms";
import { getMode } from "@/lib/env";
import { adminClient, userClient } from "@/lib/supabase/server";
import { supabaseStore } from "@/lib/data/supabase-store";
import { demoStore } from "@/lib/demo/store";

export type ActionResult = { ok: true } | { ok: false; error: string };

function message(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

export async function updateFieldAction(tableKey: string, id: string, fieldKey: string, raw: unknown): Promise<ActionResult> {
  const s = await requireUser();
  const t = tableOrNull(s.schema, tableKey);
  const f = t ? findField(t, fieldKey) : undefined;
  if (!t || !f) return { ok: false, error: "This field no longer exists. Reload the page." };
  if (!can(s, t.key, "write")) return { ok: false, error: `You can view ${t.label} but not change it. Ask an admin for editor access.` };
  const parsed = parseInput(f, raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    await s.store.update(t, id, { [f.key]: parsed.value }, { id: s.user.id, name: s.user.name });
  } catch (e) {
    return { ok: false, error: message(e) };
  }
  revalidatePath(`/t/${t.key}`, "layout");
  return { ok: true };
}

export async function addCommentAction(formData: FormData): Promise<void> {
  const s = await requireUser();
  const t = tableOrNull(s.schema, String(formData.get("table") ?? ""));
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!t || !id || !body || !can(s, t.key, "read")) return;
  await s.store.addComment(t, id, body.slice(0, 10_000), { id: s.user.id, name: s.user.name });
  revalidatePath(`/t/${t.key}/r/${id}`);
}

export async function createRecordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireUser();
  const t = tableOrNull(s.schema, String(formData.get("__table") ?? ""));
  if (!t) return { ok: false, errors: {}, message: "This table no longer exists." };
  if (!can(s, t.key, "write")) return { ok: false, errors: {}, message: `You can view ${t.label} but not add to it.` };
  const form = s.schema.forms.find((f) => f.key === formData.get("__form"));
  const { values, errors } = collectValues(formFields(t, form), formData);
  if (Object.keys(errors).length) return { ok: false, errors, message: "Fix the fields marked below." };
  let id: string;
  try {
    id = await s.store.create(t, values, { id: s.user.id, name: s.user.name });
  } catch (e) {
    return { ok: false, errors: {}, message: message(e) };
  }
  revalidatePath(`/t/${t.key}`, "layout");
  redirect(`/t/${t.key}/r/${id}`);
}

/** Public forms: no login. Only the form's own fields are accepted; writes use the service role. */
export async function submitPublicFormAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await getSession();
  const form = s.schema.forms.find((f) => f.key === formData.get("__form") && f.public);
  const t = form ? tableOrNull(s.schema, form.table) : null;
  if (!form || !t) return { ok: false, errors: {}, message: "This form is closed." };
  const { values, errors } = collectValues(formFields(t, form), formData);
  if (Object.keys(errors).length) return { ok: false, errors, message: "Fix the fields marked below." };
  const mode = getMode();
  const admin = mode.kind === "supabase" ? adminClient(mode.url) : null;
  if (mode.kind === "supabase" && !admin) return { ok: false, errors: {}, message: "This form is not set up yet (missing server key)." };
  const store = admin ? supabaseStore(admin) : demoStore;
  try {
    await store.create(t, values, null);
  } catch (e) {
    return { ok: false, errors: {}, message: message(e) };
  }
  return { ok: true, errors: {}, message: "Thanks. We got it." };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, errors: { email: "Enter your work email." } };
  const mode = getMode();
  if (mode.kind === "demo") redirect("/");
  const client = await userClient(mode.url, mode.anonKey);
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // shouldCreateUser: false → only people an admin invited can sign in.
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${site}/auth/callback` } });
  if (error) return { ok: false, errors: {}, message: `Could not send the link: ${error.message}. If you are new, ask an admin to invite you.` };
  return { ok: true, errors: {}, message: `Check ${email} for a sign-in link.` };
}

export async function signOutAction(): Promise<void> {
  const mode = getMode();
  if (mode.kind === "supabase") await (await userClient(mode.url, mode.anonKey)).auth.signOut();
  redirect("/login");
}

export async function inviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const s = await requireUser();
  if (s.user.role !== "admin") return { ok: false, errors: {}, message: "Only admins can invite people." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, errors: { email: "Enter an email address." } };
  if (!s.schema.roles.some((r) => r.key === role)) return { ok: false, errors: { role: "Pick a role." } };
  const mode = getMode();
  if (mode.kind === "demo") return { ok: true, errors: {}, message: `Demo mode: ${email} would get an invite as ${role}.` };
  const admin = adminClient(mode.url);
  if (!admin) return { ok: false, errors: {}, message: "Set SUPABASE_SERVICE_ROLE_KEY to send invites." };
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback` });
  if (error || !data.user) return { ok: false, errors: {}, message: `Could not invite: ${error?.message ?? "no user returned"}` };
  const up = await admin.from("profiles").upsert({ id: data.user.id, email, role });
  if (up.error) return { ok: false, errors: {}, message: `Invited, but the role was not saved: ${up.error.message}` };
  revalidatePath("/system");
  return { ok: true, errors: {}, message: `Invite sent to ${email} as ${role}.` };
}
