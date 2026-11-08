"use client";
import { useActionState } from "react";
import { inviteAction } from "@/app/actions";

export function InviteForm({ roles }: { roles: { key: string; label: string }[] }) {
  const [state, run, pending] = useActionState(inviteAction, { ok: false, errors: {} });
  return (
    <form action={run} className="toolbar" style={{ padding: "10px 14px" }} noValidate>
      <label className="sr-only" htmlFor="invite-email">Email</label>
      <input id="invite-email" name="email" type="email" className="input" placeholder="name@company.com" style={{ flex: "1 1 220px", width: "auto" }} />
      <label className="sr-only" htmlFor="invite-role">Role</label>
      <select id="invite-role" name="role" className="select" defaultValue="editor" style={{ flex: "0 1 160px", width: "auto" }}>
        {roles.filter((r) => r.key !== "pending").map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Invite"}</button>
      {state.message || state.errors.email || state.errors.role ? (
        <span className={state.ok ? "muted" : "field-error"} role="status" style={{ width: "100%" }}>{state.message ?? state.errors.email ?? state.errors.role}</span>
      ) : null}
    </form>
  );
}
