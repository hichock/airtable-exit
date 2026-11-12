import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const s = await getSession();
  const err = (await searchParams).error;
  if (s.mode.kind === "demo" || s.user) redirect("/");
  return (
    <main className="auth">
      <div className="auth-card">
        <span className="brand-mark" aria-hidden="true">{s.schema.app.name.slice(0, 1)}</span>
        <h1>Sign in to {s.schema.app.name}</h1>
        <p className="muted">We email you a link. No password. Only invited people can sign in.</p>
        <LoginForm linkError={typeof err === "string" ? err.slice(0, 300) : undefined} />
      </div>
    </main>
  );
}
