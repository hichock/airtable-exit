"use client";
import { useActionState } from "react";
import { signInAction } from "@/app/actions";

export function LoginForm() {
  const [state, run, pending] = useActionState(signInAction, { ok: false, errors: {} });
  if (state.ok) return <div className="success" role="status">{state.message}</div>;
  return (
    <form action={run} className="form-grid panel" noValidate>
      <div className="form-row">
        <label htmlFor="login-email">Work email</label>
        <input id="login-email" name="email" type="email" className="input" autoComplete="email" required />
        {state.errors.email ? <div className="field-error" role="alert">{state.errors.email}</div> : null}
      </div>
      {state.message ? <div className="field-error" role="alert">{state.message}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
