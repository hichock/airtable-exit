"use client";
import { useActionState, useEffect } from "react";
import { signInAction } from "@/app/actions";

export function LoginForm({ linkError }: { linkError?: string }) {
  const [state, run, pending] = useActionState(signInAction, { ok: false, errors: {} });
  // An invite link that fell back to the Site URL lands here with its tokens after "#": finish it on /auth/callback.
  useEffect(() => {
    if (/(^|[#&])(access_token|error_description)=/.test(window.location.hash)) window.location.replace(`/auth/callback${window.location.hash}`);
  }, []);
  if (state.ok) return <div className="success" role="status">{state.message}</div>;
  return (
    <form action={run} className="form-grid panel" noValidate>
      <div className="form-row">
        <label htmlFor="login-email">Work email</label>
        <input id="login-email" name="email" type="email" className="input" autoComplete="email" required />
        {state.errors.email ? <div className="field-error" role="alert">{state.errors.email}</div> : null}
      </div>
      {state.message || linkError ? <div className="field-error" role="alert">{state.message ?? `That sign-in link did not work: ${linkError}`}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
