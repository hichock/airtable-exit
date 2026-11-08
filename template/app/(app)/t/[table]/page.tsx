import { notFound, redirect } from "next/navigation";
import { requireUser, can } from "@/lib/session";
import { tableOrNull } from "@/lib/schema/load";

export default async function TablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;
  const s = await requireUser();
  const t = tableOrNull(s.schema, table);
  if (!t || !can(s, t.key, "read") || !t.views[0]) notFound();
  redirect(`/t/${t.key}/v/${t.views[0].key}`);
}
