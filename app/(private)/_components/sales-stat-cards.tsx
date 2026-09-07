"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarMark, ClockCircle, CloseCircle } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { DashboardStats } from "@/lib/queries/dashboard";
import { useDashboardBookings } from "@/hooks/use-dashboard-bookings";
import type { DashboardBookingItem } from "@/hooks/use-dashboard-bookings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookingDetailModal } from "@/app/(private)/booking/booking-weddings/_components/booking-detail-modal";

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
    fmt: (v: number) => v.toString(),
    tone: "neutral" as const,
    filter: "total",
  },
  {
    key: "pendingBookings" as keyof DashboardStats,
    label: "Pending Approval",
    icon: ClockCircle,
    fmt: (v: number) => v.toString(),
    tone: "attention" as const,
    filter: "pending",
  },
  {
    key: "lostBookings" as keyof DashboardStats,
    label: "Lost / Canceled",
    icon: CloseCircle,
    fmt: (v: number) => v.toString(),
    tone: "negative" as const,
    filter: "lost",
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

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Confirmed": return "default";
    case "Pending": case "Uploaded": return "secondary";
    case "Lost": case "Canceled": case "Rejected": return "destructive";
    default: return "outline";
  }
}

export function SalesStatCards({ initialStats, dealFrom, dealTo, eventFrom, eventTo }: SalesStatCardsProps) {
  const { data } = useDashboardStats(dealFrom, dealTo, eventFrom, eventTo, initialStats);
  const stats = data ?? initialStats;

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const { data: bookings, isLoading } = useDashboardBookings(dealFrom, dealTo, activeFilter);
  const activeCard = cards.find((c) => c.filter === activeFilter);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  return (
    <>
      <div
        className={cn(
          "grid", "grid-cols-3", "divide-x", "divide-border",
          "rounded-2xl", "border", "border-border", "bg-card",
          "shadow-sm", "transition-shadow", "hover:shadow-md", "overflow-hidden",
        )}
      >
        {cards.map(({ key, label, icon: Icon, fmt, tone, filter }) => (
          <div
            key={key}
            onClick={() => setActiveFilter(filter)}
            className={cn("flex", "flex-col", "gap-1.5", "p-4", "sm:p-5", "cursor-pointer")}
          >
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
              {fmt(stats[key])}
            </p>
          </div>
        ))}
      </div>
      <Dialog
        open={!!activeFilter}
        onOpenChange={(open) => { if (!open) setActiveFilter(null); }}
      >
        <DialogContent className={cn("max-w-lg")}>
          <DialogHeader>
            <DialogTitle>{activeCard?.label ?? "Booking"}</DialogTitle>
            <DialogDescription>
              {dealFrom && dealTo
                ? `${format(new Date(dealFrom), "dd MMM yyyy")} – ${format(new Date(dealTo), "dd MMM yyyy")}`
                : "Semua periode"}
            </DialogDescription>
          </DialogHeader>
          <div className={cn("max-h-96", "overflow-y-auto")}>
            {isLoading ? (
              <div className={cn("flex", "flex-col", "gap-3", "py-2")}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className={cn("h-14", "w-full", "rounded-lg")} />
                ))}
              </div>
            ) : bookings && bookings.length > 0 ? (
              bookings.map((item: DashboardBookingItem) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedBookingId(item.id)}
                  className={cn("flex", "items-center", "justify-between", "py-3", "px-2", "border-b", "last:border-b-0", "cursor-pointer", "rounded-lg", "hover:bg-accent", "transition-colors")}
                >
                  <div className={cn("flex", "flex-col", "gap-0.5")}>
                    <span className={cn("text-sm", "font-medium", "text-foreground")}>
                      {item.customerName}
                    </span>
                    <span className={cn("text-xs", "text-muted-foreground")}>
                      {item.venueName} •{" "}
                      {item.eventDate ? format(new Date(item.eventDate), "dd MMM yyyy") : "-"}
                    </span>
                    {item.salesName && (
                      <span className={cn("text-xs", "text-muted-foreground")}>
                        Sales: {item.salesName}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant={statusBadgeVariant(item.bookingStatus)}
                    className={cn("text-xs", "shrink-0")}
                  >
                    {item.bookingStatus}
                  </Badge>
                </div>
              ))
            ) : (
              <p className={cn("py-8", "text-center", "text-sm", "text-muted-foreground")}>
                Tidak ada data untuk periode ini.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <BookingDetailModal
        open={!!selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        bookingId={selectedBookingId}
      />
    </>
  );
}
