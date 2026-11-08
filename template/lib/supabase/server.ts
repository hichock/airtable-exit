import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { serviceRoleKey } from "../env.ts";

/** Per-request client acting as the signed-in user (RLS applies). Create a new one per request. */
export async function userClient(url: string, anonKey: string): Promise<SupabaseClient> {
  const jar = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          for (const c of list) jar.set(c.name, c.value, c.options);
        } catch {
          // Called from a Server Component: cookies are read-only there. proxy.ts refreshes the session.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS: server only, for public forms, cron jobs and invites. */
export function adminClient(url: string): SupabaseClient | null {
  const key = serviceRoleKey();
  return key ? createPlainClient(url, key, { auth: { persistSession: false } }) : null;
}
