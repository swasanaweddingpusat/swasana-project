import { Metadata } from "next";
import { ShieldCross } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/permissions";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getDashboardCalendarEvents } from "@/lib/queries/calendar-events";
import type { DataScope } from "@/types/user";
import { SalesStatCards } from "./_components/sales-stat-cards";
import { GroupAchievementSection } from "./_components/group-achievement-section";
import { SalesLeaderboard } from "./_components/sales-leaderboard";
import { CalendarWidget } from "./_components/calendar-widget";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await auth();
  const profileId = session?.user?.profileId;
  const isAdmin = await isSuperAdmin(session?.user?.roleId);

  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) - 1 : now.getMonth();
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const { stats, groups, salesLeaderboard } = await getDashboardData(
    isAdmin ? undefined : profileId,
    startDate,
    endDate,
  );

  // Calendar widget — super-admin sees all; others scoped to their dataScope.
  let calendarScope: DataScope = "all";
  if (!isAdmin && profileId) {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { dataScope: true },
    });
    calendarScope = (profile?.dataScope as DataScope) ?? "own";
  }
  const calendarEvents = await getDashboardCalendarEvents(
    year,
    month + 1,
    isAdmin ? undefined : profileId,
    calendarScope,
  );

  const subtitle = startDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={cn("flex", "flex-col", "gap-6", "py-6")}>
      {params.error === "forbidden" && (
        <div className={cn("flex", "items-center", "gap-3", "p-4", "bg-destructive/10", "border", "border-destructive/20", "rounded-lg", "text-destructive")}>
          <ShieldCross weight="BoldDuotone" className={cn("h-5", "w-5", "shrink-0")} />
          <div>
            <p className={cn("font-semibold", "text-sm")}>Akses Ditolak</p>
            <p className={cn("text-sm", "mt-0.5")}>Anda tidak memiliki izin untuk mengakses halaman tersebut.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className={cn("text-2xl", "font-bold", "text-foreground")}>Dashboard</h1>
        <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
          Overview penjualan — {subtitle}
        </p>
      </div>

      {/* Stat Cards */}
      <SalesStatCards stats={stats} />

      {/* Main Content: 2 kolom */}
      <div className={cn("grid", "grid-cols-1", "lg:grid-cols-2", "gap-6")}>
        <GroupAchievementSection groups={groups} />
        <SalesLeaderboard sales={salesLeaderboard} />
      </div>

      {/* Calendar Event */}
      <CalendarWidget events={calendarEvents} year={year} month={month + 1} />
    </div>
  );
}
