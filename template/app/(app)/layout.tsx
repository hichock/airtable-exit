import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await requireUser();
  if (s.user.role === "pending") {
    return (
      <main className="auth">
        <div className="auth-card panel form-grid">
          <h1>Waiting for access</h1>
          <p className="muted">You are signed in as {s.user.email}, but an admin has not given you a role yet. Ask them to open System → People.</p>
        </div>
      </main>
    );
  }
  return <Shell schema={s.schema} user={s.user} mode={s.mode}>{children}</Shell>;
}
