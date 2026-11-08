// Who is asking, in which mode, with which store. One call per request (React cache).
import { cache } from "react";
import { redirect } from "next/navigation";
import { getMode, type Mode } from "./env.ts";
import { loadSchema } from "./schema/load.ts";
import type { AppSchema } from "./schema/types.ts";
import type { Store } from "./data/types.ts";
import { demoStore } from "./demo/store.ts";
import { supabaseStore } from "./data/supabase-store.ts";
import { userClient } from "./supabase/server.ts";
import { canAccess, type Action } from "./access.ts";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Session {
  mode: Mode;
  schema: AppSchema;
  store: Store;
  user: SessionUser | null;
}

const DEMO_USER: SessionUser = { id: "u-1", name: "Maya Chen", email: "maya@example.com", role: "admin" };

export const getSession = cache(async (): Promise<Session> => {
  const schema = loadSchema();
  const mode = getMode();
  if (mode.kind === "demo") return { mode, schema, store: demoStore, user: DEMO_USER };
  const client = await userClient(mode.url, mode.anonKey);
  const { data } = await client.auth.getUser();
  if (!data.user) return { mode, schema, store: supabaseStore(client), user: null };
  const { data: p, error } = await client.from("profiles").select("full_name,email,role,active").eq("id", data.user.id).maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  const user: SessionUser = {
    id: data.user.id,
    email: p?.email ?? data.user.email ?? "",
    name: p?.full_name || p?.email || data.user.email || "You",
    role: p?.active === false ? "pending" : (p?.role ?? "pending"),
  };
  return { mode, schema, store: supabaseStore(client), user };
});

/** Signed in, with a role. Sends everyone else to /login. */
export async function requireUser(): Promise<Session & { user: SessionUser }> {
  const s = await getSession();
  if (!s.user) redirect("/login");
  return s as Session & { user: SessionUser };
}

export function can(s: Session, table: string, action: Action): boolean {
  return canAccess(s.schema, s.user?.role, table, action);
}
