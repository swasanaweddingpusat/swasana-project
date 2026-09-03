"use client";

import { CalendarMark, ClockCircle, CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { DashboardStats } from "@/lib/queries/dashboard";

interface SalesStatCardsProps {
  initialStats: DashboardStats;
  /** Dealing-date (createdAt) range, calendar-day strings (YYYY-MM-DD). */
  dealFrom: string;
  dealTo: string;
  /** Event-date (eventDate) range, calendar-day strings (YYYY-MM-DD). */
  eventFrom: string;
  eventTo: string;
}

const cards = [
  {
    key: "totalBookings" as keyof DashboardStats,
    label: "Total Booking",
    icon: CalendarMark,
    format: (v: number) => v.toString(),
    tone: "neutral" as const,
  },
  {
    key: "pendingBookings" as keyof DashboardStats,
    label: "Pending Approval",
    icon: ClockCircle,
    format: (v: number) => v.toString(),
    tone: "attention" as const,
  },
  {
    key: "lostBookings" as keyof DashboardStats,
    label: "Lost / Canceled",
    icon: CloseCircle,
    format: (v: number) => v.toString(),
    tone: "negative" as const,
  },
];

const TONE_CHIP: Record<(typeof cards)[number]["tone"], string> = {
  neutral: "bg-accent text-foreground",
  attention: "bg-accent text-foreground",
  negative: "bg-destructive/10 text-destructive",
};

const TONE_VALUE: Record<(typeof cards)[number]["tone"], string> = {
  neutral: "text-foreground",
  attention: "text-foreground",
  negative: "text-destructive",
};

export function SalesStatCards({ initialStats, dealFrom, dealTo, eventFrom, eventTo }: SalesStatCardsProps) {
  const { data } = useDashboardStats(dealFrom, dealTo, eventFrom, eventTo, initialStats);
  const stats = data ?? initialStats;

  return (
    <div
      className={cn(
        "grid", "grid-cols-3", "divide-x", "divide-border",
        "rounded-2xl", "border", "border-border", "bg-card",
        "shadow-sm", "transition-shadow", "hover:shadow-md", "overflow-hidden",
      )}
    >
      {cards.map(({ key, label, icon: Icon, format, tone }) => (
        <div key={key} className={cn("flex", "flex-col", "gap-1.5", "p-4", "sm:p-5")}>
          <div className={cn("flex", "items-center", "justify-between", "gap-2")}>
            <span className={cn("text-xs", "font-medium", "text-muted-foreground", "leading-tight")}>{label}</span>
            <div
              className={cn(
                "hidden", "sm:flex", "h-9", "w-9", "shrink-0", "items-center",
                "justify-center", "rounded-xl", TONE_CHIP[tone],
              )}
            >
              <Icon weight="BoldDuotone" className="h-4 w-4" />
            </div>
          </div>
          <p
            className={cn(
              "font-heading", "text-xl", "sm:text-2xl", "lg:text-3xl",
              "font-semibold", "leading-tight", TONE_VALUE[tone],
            )}
          >
            {format(stats[key])}
          </p>
        </div>
      ))}
    </div>
  );
}
