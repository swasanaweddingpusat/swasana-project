import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata = { title: "HRD Overview" };

export default async function HrdOverviewPage(): Promise<React.JSX.Element> {
  await requirePagePermission("hr", "view");
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="font-heading text-xl text-foreground">HRD Overview</h1>
      <p className="mt-2 text-muted-foreground">Ringkasan module SDM segera hadir.</p>
    </div>
  );
}
