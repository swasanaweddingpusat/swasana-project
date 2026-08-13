import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata = { title: "Booking Overview" };

export default async function BookingOverviewPage(): Promise<React.JSX.Element> {
  await requirePagePermission("booking", "view");
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="font-heading text-xl text-foreground">Booking Overview</h1>
      <p className="mt-2 text-muted-foreground">Ringkasan module booking segera hadir.</p>
    </div>
  );
}
