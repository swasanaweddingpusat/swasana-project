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
  WalletMoney,
} from "@solar-icons/react";
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

function formatCurrencyFull(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
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

const DUMMY_TARGET_MULTIPLIER = 1.35;
const DUMMY_TARGET_FLOOR = 1_000_000;

function resolveDummyTarget(item: SalesPerformanceCardItem): number {
  if (item.hasTarget && item.target > 0) return item.target;
  if (item.revenue <= 0) return DUMMY_TARGET_FLOOR;
  return Math.round((item.revenue * DUMMY_TARGET_MULTIPLIER) / 100_000) * 100_000;
}

function SalesListRow({
  item,
  rank,
  onClick,
}: {
  item: SalesPerformanceCardItem;
  rank: number;
  onClick?: () => void;
}) {
  const target = resolveDummyTarget(item);
  const collected = item.revenue;
  const pct = target > 0 ? Math.min(100, Math.round((collected / target) * 100)) : 0;

  return (
    <li
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4",
        rank === 0 && "bg-[var(--brand-gold)]/5",
        onClick && "cursor-pointer hover:bg-accent transition-colors",
      )}
    >
      <span
        className={cn(
          "w-4 shrink-0 text-center font-mono text-xs",
          rank === 0 ? "font-semibold text-[var(--brand-gold)]" : "text-muted-foreground",
        )}
      >
        {rank + 1}
      </span>
      <AvatarCircle name={item.name} avatarUrl={item.avatarUrl} rank={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        {item.groupName && (
          <p className="text-xs text-muted-foreground">{item.groupName}</p>
        )}
        <p className="text-xs text-muted-foreground">{item.bookingCount} booking</p>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatCurrency(collected)}
        </p>
      </div>
    </li>
  );
}

function SalesPerformanceTable({
  data,
  onSalesClick,
}: {
  data: SalesPerformanceCardItem[];
  onSalesClick?: (item: SalesPerformanceCardItem) => void;
}) {
  return (
    <ol className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {data.map((item, idx) => (
        <SalesListRow
          key={item.profileId}
          item={item}
          rank={idx}
          onClick={onSalesClick ? () => onSalesClick(item) : undefined}
        />
      ))}
    </ol>
  );
}

// ─── Total Revenue Card ──────────────────────────────────────────────────────

function TotalRevenueCard({ data }: { data: SalesPerformanceCardItem[] }) {
  const totalRevenue = useMemo(
    () => data.reduce((sum, item) => sum + item.revenue, 0),
    [data],
  );
  const totalBookings = useMemo(
    () => data.reduce((sum, item) => sum + item.bookingCount, 0),
    [data],
  );

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          "bg-primary/10",
        )}
      >
        <WalletMoney weight="BoldDuotone" className="h-6 w-6 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
        <p className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
          {formatCurrencyFull(totalRevenue)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-medium text-muted-foreground">Booking</p>
        <p className="font-heading text-xl font-semibold text-foreground">
          {totalBookings}
        </p>
      </div>
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

        <TotalRevenueCard data={data} />

        <SalesPerformanceTable data={data} onSalesClick={setSelectedSales} />
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
