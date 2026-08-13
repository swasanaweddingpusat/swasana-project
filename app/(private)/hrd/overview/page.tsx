import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata = { title: "HRD Overview" };

// Mirror the hrd module's permission map (prisma seed mpm_hrd_*) so any role
// that getAccessibleModules() grants the module can also open its overview.
const HRD_MODULES = ["hr", "hr-recruitment"];

export default async function HrdOverviewPage(): Promise<React.JSX.Element> {
  await requirePagePermission(HRD_MODULES, "view");
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h1 className="font-heading text-xl text-foreground">HRD Overview</h1>
      <p className="mt-2 text-muted-foreground">Ringkasan module SDM segera hadir.</p>
    </div>
  );
}
