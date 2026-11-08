// Health check for uptime monitors and the weekly health skill. No secrets in the answer.
import { NextResponse } from "next/server";
import { getMode } from "@/lib/env";
import { loadSchema } from "@/lib/schema/load";

export const dynamic = "force-dynamic";

export function GET() {
  const mode = getMode();
  const schema = loadSchema();
  return NextResponse.json({ ok: true, mode: mode.kind, app: schema.app.name, tables: schema.tables.length, time: new Date().toISOString() });
}
