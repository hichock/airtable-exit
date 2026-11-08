import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadDashboard } from "@/lib/loaders";
import { Dashboard } from "@/components/Dashboard";

export default async function DashboardPage({ params }: { params: Promise<{ dash: string }> }) {
  const { dash } = await params;
  const s = await requireUser();
  const d = s.schema.dashboards.find((x) => x.key === dash);
  if (!d) notFound();
  return <Dashboard vm={await loadDashboard(s, d)} />;
}
