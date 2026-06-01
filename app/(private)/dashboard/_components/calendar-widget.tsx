"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Calendar,
  AltArrowRight,
  AltArrowLeft,
} from "@solar-icons/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardCalendarEvents } from "@/hooks/use-dashboard-calendar-events";
import type { DashboardCalendarEventsResult, DashboardCalendarEventItem } from "@/lib/queries/calendar-events";
import { cn } from "@/lib/utils";

interface CalendarWidgetProps {
  events: DashboardCalendarEventsResult;
  year: number;
  /** 1-based month (Januari = 1) */
  month: number;
}

type ViewMode = "month" | "week";

interface DayDetail {
  date: Date;
  events: DashboardCalendarEventItem[];
}

const DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 2 + i);

const SESSION_LABEL: Record<string, string> = {
  morning: "Pagi",
  evening: "Malam",
  fullday: "Full Day",
};

function getDotClass(status: string): string {
  if (status === "Confirmed") return "bg-primary";
  if (status === "Canceled" || status === "Rejected" || status === "Lost") return "bg-destructive";
  return "bg-muted-foreground";
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Confirmed") return "default";
  if (status === "Canceled" || status === "Rejected" || status === "Lost") return "destructive";
  return "secondary";
}

function getSessionLabel(session: string | null | undefined): string {
  return session ? (SESSION_LABEL[session] ?? "Event") : "Event";
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── Month View (compact) ──────────────────────────────────────────────────────

interface MonthViewProps {
  events: DashboardCalendarEventsResult;
  year: number;
  month: number;
  onDayClick: (detail: DayDetail) => void;
}

function MonthView({ events, year, month, onDayClick }: MonthViewProps): React.ReactElement {
  const monthDate = new Date(year, month - 1, 1);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardCalendarEventItem[]>();
    for (const event of events) {
      const key = new Date(event.displayDate).toDateString();
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  return (
    <div className={cn("overflow-hidden", "rounded-lg", "border", "border-border")}>
      {/* Day headers */}
      <div className={cn("grid", "grid-cols-7", "bg-muted/30")}>
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className={cn("px-1", "py-1.5", "text-center", "text-[11px]", "font-medium", "text-muted-foreground")}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className={cn("grid", "grid-cols-7")}>
        {days.map((day) => {
          const dayEvents = eventsByDate.get(day.toDateString()) ?? [];
          const visible = dayEvents.slice(0, 2);
          const remaining = dayEvents.length - visible.length;
          const sameMonth = isSameMonth(day, monthDate);
          const today = isToday(day);
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={day.toISOString()}
              onClick={hasEvents ? () => onDayClick({ date: day, events: dayEvents }) : undefined}
              className={cn(
                "min-h-16 border-b border-r border-border p-1 last-of-type:border-r-0",
                !sameMonth && "bg-muted/20",
                hasEvents && "cursor-pointer transition-colors hover:bg-accent/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                  today && "bg-primary text-primary-foreground",
                  !today && sameMonth && "text-foreground",
                  !today && !sameMonth && "text-muted-foreground/40",
                )}
              >
                {day.getDate()}
              </span>

              <div className={cn("mt-0.5", "flex", "flex-col", "gap-0.5")}>
                {visible.map((event) => (
                  <div key={event.id} className={cn("flex", "items-center", "gap-1")}>
                    <span className={cn("size-1.5", "shrink-0", "rounded-full", getDotClass(event.bookingStatus))} />
                    <span
                      className={cn(
                        "truncate text-[10px] leading-tight",
                        sameMonth ? "text-foreground/80" : "text-muted-foreground/40",
                      )}
                    >
                      {event.customerName ?? "Event"}
                    </span>
                  </div>
                ))}
                {remaining > 0 && (
                  <span className={cn("text-[10px]", "text-muted-foreground")}>
                    +{remaining} lagi
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View (compact) ──────────────────────────────────────────────────────

interface WeekViewProps {
  events: DashboardCalendarEventsResult;
  anchorDate: Date;
  onDayClick: (detail: DayDetail) => void;
}

function WeekView({ events, anchorDate, onDayClick }: WeekViewProps): React.ReactElement {
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(anchorDate, { weekStartsOn: 1 }),
        end: endOfWeek(anchorDate, { weekStartsOn: 1 }),
      }),
    [anchorDate],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardCalendarEventItem[]>();
    for (const event of events) {
      const key = new Date(event.displayDate).toDateString();
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
    }
    return map;
  }, [events]);

  return (
    <div className={cn("grid", "grid-cols-7", "overflow-hidden", "rounded-lg", "border", "border-border")}>
      {weekDays.map((day, i) => {
        const dayEvents = eventsByDate.get(day.toDateString()) ?? [];
        const today = isToday(day);
        const hasEvents = dayEvents.length > 0;

        return (
          <div key={day.toISOString()} className={cn("flex", "flex-col", i < 6 && "border-r", "border-border")}>
            {/* Header */}
            <div className={cn("border-b", "border-border", "bg-muted/30", "px-1", "py-1.5", "text-center")}>
              <div className={cn("text-[10px]", "text-muted-foreground")}>{DAY_HEADERS[i]}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  today && "bg-primary text-primary-foreground",
                  !today && "text-foreground",
                )}
              >
                {day.getDate()}
              </div>
            </div>

            {/* Events */}
            <div
              className={cn(
                "min-h-24 p-1 flex flex-col gap-0.5",
                hasEvents && "cursor-pointer hover:bg-accent/20 transition-colors",
              )}
              onClick={hasEvents ? () => onDayClick({ date: day, events: dayEvents }) : undefined}
            >
              {dayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className={cn("flex", "items-center", "gap-1")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", getDotClass(event.bookingStatus))} />
                  <span className={cn("truncate text-[10px] leading-tight text-foreground/80")}>
                    {event.customerName ?? "Event"}
                  </span>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <span className={cn("text-[10px]", "text-muted-foreground")}>
                  +{dayEvents.length - 3} lagi
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Event Detail Dialog ──────────────────────────────────────────────────────

interface EventDetailDialogProps {
  detail: DayDetail | null;
  onClose: () => void;
}

function EventDetailDialog({ detail, onClose }: EventDetailDialogProps): React.ReactElement {
  return (
    <Dialog open={detail !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton className={cn("max-w-sm")}>
        <DialogTitle className="text-sm font-semibold">
          {detail ? format(detail.date, "EEEE, d MMMM yyyy", { locale: localeId }) : ""}
        </DialogTitle>
        {detail && (
          <div className={cn("flex", "flex-col", "gap-2", "mt-1")}>
            {detail.events.map((event) => (
              <div
                key={event.id}
                className={cn("rounded-xl", "border", "border-border", "bg-muted/30", "p-3", "text-xs")}
              >
                <div className={cn("flex", "items-start", "justify-between", "gap-2", "mb-1.5")}>
                  <span className={cn("font-medium", "text-foreground", "leading-snug")}>
                    {event.customerName ?? "—"}
                  </span>
                  <Badge variant={getStatusVariant(event.bookingStatus)} className="shrink-0">
                    {event.bookingStatus}
                  </Badge>
                </div>
                <div className={cn("space-y-0.5", "text-muted-foreground")}>
                  <p className="truncate">{event.venueName ?? "—"}</p>
                  {event.weddingSession && (
                    <p>Sesi: {getSessionLabel(event.weddingSession)}</p>
                  )}
                  <p className="capitalize">{event.category === "MICE" ? "MICE" : "Wedding"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Widget ─────────────────────────────────────────────────────────────

export function CalendarWidget({ events: initialEvents, year: initialYear, month: initialMonth }: CalendarWidgetProps): React.ReactElement {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  // anchorDate dipakai di week view untuk navigasi minggu
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date(initialYear, initialMonth - 1, 1));
  const [selectedDetail, setSelectedDetail] = useState<DayDetail | null>(null);

  const { data: events = [] } = useDashboardCalendarEvents(
    year,
    month,
    year === initialYear && month === initialMonth ? initialEvents : undefined,
  );

  const daysInMonth = getDaysInMonth(year, month);

  // ── Navigasi bulan ──────────────────────────────────────────────────────────
  function handlePrevMonth(): void {
    const prev = subMonths(new Date(year, month - 1, 1), 1);
    setYear(prev.getFullYear());
    setMonth(prev.getMonth() + 1);
    setAnchorDate(prev);
  }

  function handleNextMonth(): void {
    const next = addMonths(new Date(year, month - 1, 1), 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
    setAnchorDate(next);
  }

  // ── Navigasi minggu ─────────────────────────────────────────────────────────
  function handlePrevWeek(): void {
    const prev = subWeeks(anchorDate, 1);
    setAnchorDate(prev);
    setYear(prev.getFullYear());
    setMonth(prev.getMonth() + 1);
  }

  function handleNextWeek(): void {
    const next = addWeeks(anchorDate, 1);
    setAnchorDate(next);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  }

  // ── Handler select tahun/bulan/hari ─────────────────────────────────────────
  function handleYearChange(val: string): void {
    const newYear = Number(val);
    setYear(newYear);
    const newAnchor = new Date(newYear, month - 1, anchorDate.getDate());
    setAnchorDate(newAnchor);
  }

  function handleMonthChange(val: string): void {
    const newMonth = Number(val);
    setMonth(newMonth);
    const newAnchor = new Date(year, newMonth - 1, 1);
    setAnchorDate(newAnchor);
  }

  function handleDayChange(val: string): void {
    const newAnchor = new Date(year, month - 1, Number(val));
    setAnchorDate(newAnchor);
  }

  function handleViewChange(mode: ViewMode): void {
    setViewMode(mode);
    if (mode === "week") {
      setAnchorDate(new Date(year, month - 1, 1));
    }
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const weekRangeLabel = useMemo(() => {
    if (viewMode !== "week") return null;
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return `${format(start, "d MMM", { locale: localeId })} – ${format(end, "d MMM yyyy", { locale: localeId })}`;
  }, [viewMode, anchorDate]);

  // Day select value: tampilkan hari dari anchorDate kalau masih di bulan/tahun yang sama
  const daySelectValue =
    anchorDate.getMonth() + 1 === month && anchorDate.getFullYear() === year
      ? String(anchorDate.getDate())
      : "";

  return (
    <div className={cn("bg-card", "border", "rounded-2xl", "p-5", "flex", "flex-col", "gap-4", "shadow-sm")}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={cn("flex", "items-center", "justify-between")}>
        <div className={cn("flex", "items-center", "gap-2")}>
          <Calendar weight="BoldDuotone" className={cn("h-5", "w-5", "text-muted-foreground")} />
          <div>
            <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Kalender Event</h2>
            <p className={cn("text-xs", "text-muted-foreground")}>
              {viewMode === "month" ? monthLabel : (weekRangeLabel ?? monthLabel)}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/calendar-events"
          className={cn("inline-flex", "items-center", "gap-1", "rounded-full", "bg-muted", "px-3", "py-1.5", "text-xs", "font-medium", "text-foreground", "transition-colors", "hover:bg-accent")}
        >
          Selengkapnya
          <AltArrowRight weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
        </Link>
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className={cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")}>
        {/* Filter + nav row */}
        <div className={cn("flex", "items-center", "gap-1.5", "flex-wrap")}>
          {/* Year select */}
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className={cn("h-8", "w-20", "text-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month select */}
          <Select value={String(month)} onValueChange={handleMonthChange}>
            <SelectTrigger className={cn("h-8", "w-28", "text-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Day select — loncat ke minggu yang mengandung hari itu */}
          <Select value={daySelectValue} onValueChange={handleDayChange}>
            <SelectTrigger className={cn("h-8", "w-16", "text-xs")}>
              <SelectValue placeholder="Tgl" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Prev / Next arrows */}
          <div className={cn("flex", "items-center", "gap-0.5")}>
            <Button
              variant="outline"
              size="icon"
              className={cn("h-8", "w-8")}
              onClick={viewMode === "month" ? handlePrevMonth : handlePrevWeek}
              aria-label="Sebelumnya"
            >
              <AltArrowLeft weight="BoldDuotone" className={cn("h-4", "w-4")} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className={cn("h-8", "w-8")}
              onClick={viewMode === "month" ? handleNextMonth : handleNextWeek}
              aria-label="Selanjutnya"
            >
              <AltArrowRight weight="BoldDuotone" className={cn("h-4", "w-4")} />
            </Button>
          </div>
        </div>

        {/* View toggle pills */}
        <div className={cn("flex", "items-center", "gap-1")}>
          {(["month", "week"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="sm"
              className={cn("h-8", "rounded-full", "px-3", "text-xs", viewMode !== mode && "text-muted-foreground")}
              onClick={() => handleViewChange(mode)}
            >
              {mode === "month" ? "Bulan" : "Minggu"}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Calendar View ──────────────────────────────────────────────────── */}
      {viewMode === "month" ? (
        <MonthView events={events} year={year} month={month} onDayClick={setSelectedDetail} />
      ) : (
        <WeekView events={events} anchorDate={anchorDate} onDayClick={setSelectedDetail} />
      )}

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className={cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")}>
        <span className={cn("flex", "items-center", "gap-1.5", "text-xs", "text-muted-foreground")}>
          <span className={cn("size-1.5", "rounded-full", "bg-primary")} /> Confirmed
        </span>
        <span className={cn("flex", "items-center", "gap-1.5", "text-xs", "text-muted-foreground")}>
          <span className={cn("size-1.5", "rounded-full", "bg-muted-foreground")} /> Pending
        </span>
        <span className={cn("flex", "items-center", "gap-1.5", "text-xs", "text-muted-foreground")}>
          <span className={cn("size-1.5", "rounded-full", "bg-destructive")} /> Batal/Ditolak
        </span>
      </div>

      {/* ── Event Detail Dialog ─────────────────────────────────────────────── */}
      <EventDetailDialog detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </div>
  );
}
