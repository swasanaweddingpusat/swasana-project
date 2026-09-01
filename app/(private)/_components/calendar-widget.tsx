"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Calendar, AltArrowLeft, AltArrowRight } from "@solar-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// 1-based month index → Indonesian label (Januari = 1).
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

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

function handleDayActivate(e: React.KeyboardEvent, onActivate: () => void): void {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    onActivate();
  }
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
              onKeyDown={hasEvents ? (e) => handleDayActivate(e, () => onDayClick({ date: day, events: dayEvents })) : undefined}
              role={hasEvents ? "button" : undefined}
              tabIndex={hasEvents ? 0 : undefined}
              aria-label={hasEvents ? `${format(day, "d MMMM", { locale: localeId })}, ${dayEvents.length} event` : undefined}
              className={cn(
                "min-h-12 border-b border-r border-border p-0.5 last-of-type:border-r-0 sm:min-h-16 sm:p-1",
                !sameMonth && "bg-muted/20",
                hasEvents && "cursor-pointer transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium sm:h-5 sm:w-5 sm:text-[11px]",
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
                        "hidden truncate text-[10px] leading-tight sm:inline",
                        sameMonth ? "text-foreground/80" : "text-muted-foreground/40",
                      )}
                    >
                      {event.customerName ?? "Event"}
                    </span>
                  </div>
                ))}
                {remaining > 0 && (
                  <>
                    <span className={cn("text-[9px]", "text-muted-foreground", "sm:hidden")}>
                      +{remaining}
                    </span>
                    <span className={cn("hidden", "text-[10px]", "text-muted-foreground", "sm:inline")}>
                      +{remaining} lagi
                    </span>
                  </>
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
              <div className={cn("text-[9px]", "text-muted-foreground", "sm:text-[10px]")}>{DAY_HEADERS[i]}</div>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium sm:h-6 sm:w-6 sm:text-xs",
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
                "min-h-16 p-0.5 flex flex-col gap-0.5 sm:min-h-24 sm:p-1",
                hasEvents && "cursor-pointer hover:bg-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
              onClick={hasEvents ? () => onDayClick({ date: day, events: dayEvents }) : undefined}
              onKeyDown={hasEvents ? (e) => handleDayActivate(e, () => onDayClick({ date: day, events: dayEvents })) : undefined}
              role={hasEvents ? "button" : undefined}
              tabIndex={hasEvents ? 0 : undefined}
              aria-label={hasEvents ? `${format(day, "d MMMM", { locale: localeId })}, ${dayEvents.length} event` : undefined}
            >
              {dayEvents.slice(0, 3).map((event) => (
                <div key={event.id} className={cn("flex", "items-center", "gap-1")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", getDotClass(event.bookingStatus))} />
                  <span className={cn("hidden truncate text-[10px] leading-tight text-foreground/80 sm:inline")}>
                    {event.customerName ?? "Event"}
                  </span>
                </div>
              ))}
              {dayEvents.length > 3 && (
                <>
                  <span className={cn("text-[9px]", "text-muted-foreground", "sm:hidden")}>
                    +{dayEvents.length - 3}
                  </span>
                  <span className={cn("hidden", "text-[10px]", "text-muted-foreground", "sm:inline")}>
                    +{dayEvents.length - 3} lagi
                  </span>
                </>
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
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDetail, setSelectedDetail] = useState<DayDetail | null>(null);

  // Bulan/tahun aktif — dipilih lewat filter di header. Diinisialisasi dari
  // bulan yang di-render server (initialYear/initialMonth).
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // Seed data server HANYA untuk bulan yang di-render server; bulan lain fetch fresh.
  const isInitialMonth = year === initialYear && month === initialMonth;
  const { data: events = [] } = useDashboardCalendarEvents(
    year,
    month,
    isInitialMonth ? initialEvents : undefined,
  );

  // anchorDate = awal bulan yang sedang aktif
  const anchorDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  function handleViewChange(mode: ViewMode): void {
    setViewMode(mode);
  }

  // Step satu bulan (rollover tahun otomatis lewat konstruktor Date).
  function shiftMonth(delta: number): void {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  // Rentang tahun: 5 tahun ke belakang s/d 1 tahun ke depan dari bulan awal,
  // plus tahun terpilih kalau kebetulan di luar rentang.
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = initialYear - 5; y <= initialYear + 1; y++) list.push(y);
    if (!list.includes(year)) list.push(year);
    return list.sort((a, b) => b - a);
  }, [initialYear, year]);

  const monthLabel = anchorDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });

  const weekRangeLabel = useMemo(() => {
    if (viewMode !== "week") return null;
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 });
    const end = endOfWeek(anchorDate, { weekStartsOn: 1 });
    return `${format(start, "d MMM", { locale: localeId })} – ${format(end, "d MMM yyyy", { locale: localeId })}`;
  }, [viewMode, anchorDate]);

  return (
    <div className={cn("bg-card", "border", "rounded-2xl", "p-4", "sm:p-5", "flex", "flex-col", "gap-4", "shadow-sm")}>
      {/* ── Header + filter bulan/tahun ────────────────────────────────────── */}
      <div className={cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3", "min-w-0")}>
        <div className={cn("flex", "items-center", "gap-2", "min-w-0")}>
          <Calendar weight="BoldDuotone" className={cn("h-5", "w-5", "shrink-0", "text-muted-foreground")} />
          <div className={cn("min-w-0")}>
            <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Kalender Event</h2>
            <p className={cn("text-xs", "text-muted-foreground", "truncate")}>
              {viewMode === "month" ? monthLabel : (weekRangeLabel ?? monthLabel)}
            </p>
          </div>
        </div>

        {/* Filter: prev · bulan · tahun · next */}
        <div className={cn("flex", "items-center", "gap-1.5")}>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => shiftMonth(-1)}
            aria-label="Bulan sebelumnya"
          >
            <AltArrowLeft weight="BoldDuotone" className="h-4 w-4" />
          </Button>

          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger size="sm" className="w-32 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((label, idx) => (
                <SelectItem key={label} value={String(idx + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger size="sm" className="w-24 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            className="shrink-0 rounded-full"
            onClick={() => shiftMonth(1)}
            aria-label="Bulan berikutnya"
          >
            <AltArrowRight weight="BoldDuotone" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── View toggle ────────────────────────────────────────────────────── */}
      <div className={cn("flex", "items-center", "gap-1")}>
        {(["month", "week"] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? "default" : "outline"}
            size="sm"
            className={cn("h-8", "flex-1", "rounded-full", "px-3", "text-xs", "sm:flex-none", viewMode !== mode && "text-muted-foreground")}
            onClick={() => handleViewChange(mode)}
          >
            {mode === "month" ? "Bulan" : "Minggu"}
          </Button>
        ))}
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
