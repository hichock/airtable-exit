// Magic-link landing: exchanges the code for a session cookie, then opens the app.
import { NextResponse, type NextRequest } from "next/server";
import { getMode } from "@/lib/env";
import { userClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const mode = getMode();
  if (code && mode.kind === "supabase") {
    const client = await userClient(mode.url, mode.anonKey);
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
