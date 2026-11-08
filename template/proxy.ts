// Refreshes the Supabase session cookie on each request (Next.js 16 "proxy", formerly middleware).
// Does nothing in DEMO mode or without Supabase settings. Access checks live in pages, actions and RLS.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getMode } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const mode = getMode();
  let response = NextResponse.next({ request });
  if (mode.kind !== "supabase") return response;
  const supabase = createServerClient(mode.url, mode.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const c of list) request.cookies.set(c.name, c.value);
        response = NextResponse.next({ request });
        for (const c of list) response.cookies.set(c.name, c.value, c.options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron|api/health|forms/).*)"],
};
