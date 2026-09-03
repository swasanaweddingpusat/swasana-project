import { Metadata } from "next";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ShieldCross } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { getDashboardData, resolveDealingRange, resolveEventRange } from "@/lib/queries/dashboard";
import { getDashboardCalendarEvents } from "@/lib/queries/calendar-events";
import { getTopSalesByRecentBooking } from "@/lib/queries/salesPerformance";
import { getActiveBanners } from "@/lib/queries/banners";
import { SalesStatCards } from "./_components/sales-stat-cards";
import { GroupAchievementSection } from "./_components/group-achievement-section";
import { CalendarWidget } from "./_components/calendar-widget";
import { SalesPerformanceSection } from "./_components/SalesPerformanceSection";
import { CrmOverviewMetrics } from "./_components/crm-overview-metrics";
import { DashboardFilterDrawer } from "./_components/dashboard-filter-drawer";
import { DashboardBannerCarousel } from "./_components/dashboard-banner-carousel";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  const now = new Date();
  // Calendar widget always shows the current month — it is not driven by the
  // dealing-date filter (see calendar-widget.tsx, unchanged).
  const calendarYear = now.getFullYear();
  const calendarMonth = now.getMonth();

  // Dealing-date (createdAt) range — drives every stat/performance section
  // below. Absent `dealFrom`/`dealTo` → no range (all-time, whole DB).
  const { range, fromDay, toDay } = resolveDealingRange(params.dealFrom, params.dealTo);

  // Event-date (eventDate) range — composes via AND with the dealing-date
  // range above, scoped to the SAME three sections (stats, sales performance,
  // group achievement). Absent `eventFrom`/`eventTo` → no range.
  const {
    range: eventRange,
    fromDay: eventFromDay,
    toDay: eventToDay,
  } = resolveEventRange(params.eventFrom, params.eventTo);

  // Overview is company-wide: every booking-scoped section here shows ALL data,
  // regardless of the viewer's dataScope (own/group/all). This applies ONLY to
  // the dashboard endpoints — other menus (booking listing, booking calendar,
  // finance, etc.) still enforce per-user dataScope. Hence `undefined`/"all".
  const dashboardDataPromise = getDashboardData(undefined, range, eventRange);

  const calendarEventsPromise = getDashboardCalendarEvents(
    calendarYear,
    calendarMonth + 1,
    undefined,
    "all",
  );

  const bannersPromise = getActiveBanners("dashboard");

  const [{ stats, groups }, calendarEvents, banners] = await Promise.all([
    dashboardDataPromise,
    calendarEventsPromise,
    bannersPromise,
  ]);

  const topSalesData = await getTopSalesByRecentBooking(undefined, range, eventRange);

  // No filter picked → whole-database totals. Otherwise show the picked range
  // (display uses the inclusive `toDay`, not the exclusive `to` upper bound).
  let subtitle = "seluruh data";
  if (fromDay) {
    const fromDisplay = new Date(`${fromDay}T00:00:00`);
    const toDisplay = new Date(`${toDay}T00:00:00`);
    subtitle =
      fromDay === toDay
        ? format(fromDisplay, "d MMM yyyy", { locale: localeId })
        : `${format(fromDisplay, "d MMM", { locale: localeId })} – ${format(toDisplay, "d MMM yyyy", { locale: localeId })}`;
  }

  return (
    <div className={cn("flex", "flex-col", "gap-6", "pt-3", "pb-6")}>
      {params.error === "forbidden" && (
        <div className={cn("flex", "items-center", "gap-3", "p-4", "bg-destructive/10", "border", "border-destructive/20", "rounded-lg", "text-destructive")}>
          <ShieldCross weight="BoldDuotone" className={cn("h-5", "w-5", "shrink-0")} />
          <div>
            <p className={cn("font-semibold", "text-sm")}>Akses Ditolak</p>
            <p className={cn("text-sm", "mt-0.5")}>Anda tidak memiliki izin untuk mengakses halaman tersebut.</p>
          </div>
        </div>
      )}

      {/* Banner — carousel, dikelola dari Settings > Banner (DB-driven) */}
      <DashboardBannerCarousel banners={banners} />

      {/* Header + Filter — Tanggal Dealing drives every dealing-scoped section below */}
      <div
        className={cn(
          "flex", "flex-col", "gap-3", "sm:flex-row", "sm:items-center", "sm:justify-between",
          "rounded-2xl", "border", "border-border", "bg-card",
          "p-4", "sm:p-5", "shadow-sm",
        )}
      >
        <div>
          <h1 className={cn("text-2xl", "font-bold", "text-foreground")}>Dashboard</h1>
          <p className={cn("text-sm", "text-muted-foreground", "mt-1")}>
            Overview penjualan — {subtitle}
          </p>
        </div>
        <DashboardFilterDrawer />
      </div>

      {/* Stat Cards */}
      <SalesStatCards
        initialStats={stats}
        dealFrom={fromDay}
        dealTo={toDay}
        eventFrom={eventFromDay}
        eventTo={eventToDay}
      />

      {/* Achievement & Performance Sales */}
      <SalesPerformanceSection
        initialData={topSalesData}
        dealFrom={fromDay}
        dealTo={toDay}
        eventFrom={eventFromDay}
        eventTo={eventToDay}
      />

      {/* Group achievement — list, full width */}
      <GroupAchievementSection
        initialGroups={groups}
        dealFrom={fromDay}
        dealTo={toDay}
        eventFrom={eventFromDay}
        eventTo={eventToDay}
      />

      {/* Calendar Event — defaults to the current month (own bulan/tahun filter), independent of the dealing-date filter */}
      <CalendarWidget events={calendarEvents} year={calendarYear} month={calendarMonth + 1} />

      {/* CRM: Database Kantor vs Mandiri (mirror Bitrix Overview) — self-filtered — paling bawah */}
      <CrmOverviewMetrics />
    </div>
  );
}
