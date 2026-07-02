"use client";

import { GraphUp, CalendarMark, ClockCircle, CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { DashboardStats } from "@/lib/queries/dashboard";

interface SalesStatCardsProps {
  initialStats: DashboardStats;
  year: number;
  month: number; // 1-indexed
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

const cards = [
  {
    key: "totalBookings" as keyof DashboardStats,
    label: "Total Booking",
    icon: CalendarMark,
    format: (v: number) => v.toString(),
  },
  {
    key: "totalRevenue" as keyof DashboardStats,
    label: "Revenue Confirmed",
    icon: GraphUp,
    format: formatCurrency,
  },
  {
    key: "pendingBookings" as keyof DashboardStats,
    label: "Pending Approval",
    icon: ClockCircle,
    format: (v: number) => v.toString(),
  },
  {
    key: "lostBookings" as keyof DashboardStats,
    label: "Lost / Canceled",
    icon: CloseCircle,
    format: (v: number) => v.toString(),
  },
];

export function SalesStatCards({ initialStats, year, month }: SalesStatCardsProps) {
  const { data } = useDashboardStats(year, month, initialStats);
  const stats = data ?? initialStats;

  return (
    <div className={cn("flex", "flex-wrap", "gap-4")}>
      {cards.map(({ key, label, icon: Icon, format }) => (
        <div
          key={key}
          className={cn("min-w-40", "flex-1", "bg-card", "border", "rounded-xl", "p-6", "flex", "flex-col", "gap-3")}
        >
          <Icon weight="BoldDuotone" className={cn("h-5", "w-5", "text-muted-foreground")} />
          <span className={cn("text-3xl", "font-bold", "leading-none", "text-foreground")}>
            {format(stats[key])}
          </span>
          <span className={cn("text-sm", "text-muted-foreground")}>{label}</span>
        </div>
      ))}
    </div>
  );
}
