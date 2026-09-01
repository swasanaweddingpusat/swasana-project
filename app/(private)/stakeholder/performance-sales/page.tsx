import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import { getGroupsWithPerformance } from "@/lib/queries/groups";
import { PerformanceSalesClient } from "./_components/PerformanceSalesClient";

interface SearchParams {
  year?: string;
}

export default async function PerformanceSalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();
  const session = await auth();
  if (!session?.user.profileId) redirect("/auth/login");

  const isAdmin = await isSuperAdmin(session.user.roleId);
  const canView =
    isAdmin || (await hasPermission(session.user.roleId, "performance-sales", "view"));
  if (!canView) redirect("/forbidden");

  const { year: yearParam } = await searchParams;
  const now = new Date();
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : now.getFullYear();
  const year = Number.isFinite(parsedYear) ? parsedYear : now.getFullYear();

  const startDate = new Date(year, 0, 1);
  // Exclusive upper bound: start of next year (query uses eventDate < endDate).
  const endDate = new Date(year + 1, 0, 1);

  // Stakeholder monitors every team → view-all (profileId undefined).
  const groups = await getGroupsWithPerformance(undefined, startDate, endDate, year);

  const totalSales = groups.reduce((s, g) => s + g.revenue, 0);
  const totalTarget = groups.reduce((s, g) => s + g.target, 0);
  const avgAchievement =
    groups.length > 0
      ? Math.round(groups.reduce((s, g) => s + g.avgAchievement, 0) / groups.length)
      : 0;
  const totalConfirmed = groups.reduce((s, g) => s + g.confirmedCount, 0);
  const totalPiutang = groups.reduce((s, g) => s + g.piutang, 0);
  const totalRevenue = groups.reduce((s, g) => s + g.totalRevenue, 0);

  const summary = {
    totalGroups: groups.length,
    totalSales,
    totalTarget,
    avgAchievement,
    totalConfirmed,
    totalPiutang,
    totalRevenue,
  };

  return (
    <div className="px-2 pb-6">
      <PerformanceSalesClient groups={groups} summary={summary} year={year} />
    </div>
  );
}
