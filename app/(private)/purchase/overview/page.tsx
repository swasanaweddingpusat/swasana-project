import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata = { title: "Purchase Overview" };

export default async function PurchaseOverviewPage(): Promise<React.JSX.Element> {
  await requirePagePermission("procurement", "view");
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="font-heading text-xl text-foreground">Purchase Overview</h1>
      <p className="mt-2 text-muted-foreground">Ringkasan module pengadaan segera hadir.</p>
    </div>
  );
}
