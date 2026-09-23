"use client";

import { useState, useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CupStar,
  Crown,
  Star,
  CalendarDate,
  AltArrowLeft,
  AltArrowRight,
} from "@solar-icons/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useDashboardSalesPerformance } from "@/hooks/useDashboardSalesPerformance";
import { useDashboardBookings } from "@/hooks/use-dashboard-bookings";
import type { DashboardBookingItem } from "@/hooks/use-dashboard-bookings";
import type { SalesPerformanceCardItem } from "@/lib/queries/salesPerformance";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookingDetailModal } from "@/app/(private)/booking/booking-weddings/_components/booking-detail-modal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000)
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatChartTooltip(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const salesChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  target: { label: "Target", color: "hsl(var(--muted))" },
} satisfies ChartConfig;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PodiumIcon({ rank }: { rank: number }): React.ReactElement | null {
  if (rank === 0)
    return (
      <Crown
        weight="BoldDuotone"
        className="h-6 w-6 absolute -top-3 -right-1.5 text-[var(--brand-gold)]"
      />
    );
  if (rank === 1 || rank === 2)
    return (
      <Star
        weight="BoldDuotone"
        className="h-5 w-5 absolute -top-2.5 -right-1.5 text-[var(--brand-gold)]"
      />
    );
  return null;
}

function AvatarCircle({
  name,
  avatarUrl,
  rank,
}: {
  name: string;
  avatarUrl: string | null;
  rank: number;
}) {
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
          "bg-primary text-primary-foreground",
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          getInitials(name)
        )}
      </div>
      <PodiumIcon rank={rank} />
    </div>
  );
}

// ─── Sales Chart ──────────────────────────────────────────────────────────────

interface ChartDataItem {
  name: string;
  fullName: string;
  revenue: number;
  target?: number;
  bookingCount: number;
  groupName: string | null;
}

interface SalesTooltipPayloadEntry {
  payload: ChartDataItem;
  dataKey: string;
}

function SalesTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: SalesTooltipPayloadEntry[];
}): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{d.fullName}</p>
      {d.groupName && (
        <p className="text-muted-foreground">{d.groupName}</p>
      )}
      <p className="mt-1 text-muted-foreground">{d.bookingCount} booking</p>
      <div className="mt-1 flex flex-col gap-0.5">
        <p className="font-semibold text-foreground">Revenue: {formatChartTooltip(d.revenue)}</p>
        {d.target !== undefined && (
          <p className="text-muted-foreground">Target: {formatChartTooltip(d.target)}</p>
        )}
      </div>
    </div>
  );
}

function SalesChart({ data }: { data: SalesPerformanceCardItem[] }) {
  const chartData = useMemo<ChartDataItem[]>(() => {
    return data.slice(0, 10).map((item) => ({
      name: item.name.length > 15 ? item.name.slice(0, 15) + "…" : item.name,
      fullName: item.name,
      revenue: item.revenue,
      target: item.hasTarget && item.target > 0 ? item.target : undefined,
      bookingCount: item.bookingCount,
      groupName: item.groupName,
    }));
  }, [data]);

  const chartHeight = Math.max(200, chartData.length * 40 + 40);

  const hasAnyTarget = chartData.some((d) => d.target !== undefined);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
      <ChartContainer config={salesChartConfig} className="aspect-auto" style={{ height: chartHeight }}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <YAxis
            dataKey="name"
            type="category"
            width={110}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ChartTooltip content={<SalesTooltipContent />} />
          <Bar
            dataKey="revenue"
            name="revenue"
            fill="hsl(var(--primary))"
            radius={[0, 4, 4, 0]}
            barSize={hasAnyTarget ? 10 : 16}
          />
          {hasAnyTarget && (
            <Bar
              dataKey="target"
              name="target"
              fill="hsl(var(--muted))"
              radius={[0, 4, 4, 0]}
              barSize={10}
            />
          )}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

// ─── Month Picker ────────────────────────────────────────────────────────────

function MonthPicker({
  year,
  month,
  onPrev,
  onNext,
  isCurrentMonth,
}: {
  year: number;
  month: number;
  onPrev: () => void;
  onNext: () => void;
  isCurrentMonth: boolean;
}) {
  const label = format(new Date(year, month, 1), "MMMM yyyy", { locale: localeId });

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onPrev}
      >
        <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
      </Button>
      <span className="min-w-28 text-center text-sm font-medium text-foreground capitalize">
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onNext}
        disabled={isCurrentMonth}
      >
        <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface SalesPerformanceSectionProps {
  initialData: SalesPerformanceCardItem[];
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Confirmed": return "default";
    case "Pending": case "Uploaded": return "secondary";
    case "Lost": case "Canceled": case "Rejected": return "destructive";
    default: return "outline";
  }
}

export function SalesPerformanceSection({
  initialData,
}: SalesPerformanceSectionProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const { from: dealFrom, to: dealTo } = useMemo(
    () => getMonthRange(year, month),
    [year, month],
  );

  const { data: liveData } = useDashboardSalesPerformance(
    dealFrom,
    dealTo,
    "",
    "",
    isCurrentMonth ? initialData : undefined,
  );
  const data = liveData ?? initialData;

  const [selectedSales, setSelectedSales] = useState<SalesPerformanceCardItem | null>(null);
  const { data: salesBookings, isLoading: salesBookingsLoading } = useDashboardBookings(
    dealFrom,
    dealTo,
    selectedSales ? "total" : null,
    selectedSales?.profileId,
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  function handlePrevMonth(): void {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function handleNextMonth(): void {
    if (isCurrentMonth) return;
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CupStar weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
            <h2 className="text-base font-semibold text-foreground">
              Achievement & Performance Sales
            </h2>
          </div>
          <MonthPicker
            year={year}
            month={month}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
            isCurrentMonth={isCurrentMonth}
          />
        </div>
        <div className="bg-card border rounded-2xl p-6 flex flex-col items-center gap-3 text-center shadow-sm">
          <CalendarDate weight="BoldDuotone" className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Belum ada data booking di periode ini.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CupStar weight="BoldDuotone" className="h-5 w-5 text-[var(--brand-gold)]" />
            <h2 className="text-base font-semibold text-foreground">
              Achievement & Performance Sales
            </h2>
          </div>
          <MonthPicker
            year={year}
            month={month}
            onPrev={handlePrevMonth}
            onNext={handleNextMonth}
            isCurrentMonth={isCurrentMonth}
          />
        </div>

        <SalesChart data={data} />

        <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {data.map((item, idx) => (
            <li
              key={item.profileId}
              onClick={() => setSelectedSales(item)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4",
                idx === 0 && "bg-[var(--brand-gold)]/5",
                "cursor-pointer hover:bg-accent transition-colors",
              )}
            >
              <span
                className={cn(
                  "w-4 shrink-0 text-center font-mono text-xs",
                  idx === 0 ? "font-semibold text-[var(--brand-gold)]" : "text-muted-foreground",
                )}
              >
                {idx + 1}
              </span>
              <AvatarCircle name={item.name} avatarUrl={item.avatarUrl} rank={idx} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                {item.groupName && (
                  <p className="text-xs text-muted-foreground">{item.groupName}</p>
                )}
                <p className="text-xs text-muted-foreground">{item.bookingCount} booking</p>
                {item.bookingCount > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      Reguler {item.packageTypeBreakdown.reguler.count}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Hadjatan {item.packageTypeBreakdown.hadjatan.count}
                    </Badge>
                  </div>
                )}
                {item.homebaseBreakdown.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {item.homebaseBreakdown.map((homebase) => (
                      <Badge key={homebase.venueId} variant="secondary" className="text-[10px]">
                        {homebase.venueName}: {homebase.count} dealing
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
                {formatCurrency(item.revenue)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <Dialog
        open={!!selectedSales}
        onOpenChange={(open) => { if (!open) setSelectedSales(null); }}
      >
        <DialogContent className={cn("max-w-lg")}>
          <DialogHeader>
            <DialogTitle>Booking — {selectedSales?.name}</DialogTitle>
            <DialogDescription>
              {selectedSales
                ? `${selectedSales.bookingCount} booking • ${formatCurrency(selectedSales.revenue)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className={cn("max-h-96", "overflow-y-auto")}>
            {salesBookingsLoading ? (
              <div className={cn("flex", "flex-col", "gap-3", "py-2")}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className={cn("h-14", "w-full", "rounded-lg")} />
                ))}
              </div>
            ) : salesBookings && salesBookings.length > 0 ? (
              salesBookings.map((item: DashboardBookingItem) => (
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
                Tidak ada data booking.
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
