import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadDashboard } from "@/lib/loaders";
import { Dashboard } from "@/components/Dashboard";

export default async function Home() {
  const s = await requireUser();
  const d = s.schema.dashboards[0];
  if (!d) redirect(`/t/${s.schema.tables[0]?.key ?? ""}`);
  return <Dashboard vm={await loadDashboard(s, d)} />;
}
