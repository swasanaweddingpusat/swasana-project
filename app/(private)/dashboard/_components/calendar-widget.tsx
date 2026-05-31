import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";
import { Calendar, AltArrowRight } from "@solar-icons/react";
import type { DashboardCalendarEventsResult } from "@/lib/queries/calendar-events";
import { cn } from "@/lib/utils";

interface CalendarWidgetProps {
  events: DashboardCalendarEventsResult;
  year: number;
  /** 1-based month (Januari = 1) */
  month: number;
}

const DAY_HEADERS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function getDotClass(status: string): string {
  if (status === "Confirmed") return "bg-primary";
  if (status === "Canceled" || status === "Rejected" || status === "Lost") return "bg-destructive";
  return "bg-muted-foreground";
}

export function CalendarWidget({ events, year, month }: CalendarWidgetProps) {
  const monthDate = new Date(year, month - 1, 1);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 }),
  });

  const eventsByDate = new Map<string, DashboardCalendarEventsResult>();
  for (const event of events) {
    const key = new Date(event.displayDate).toDateString();
    const list = eventsByDate.get(key);
    if (list) {
      list.push(event);
    } else {
      eventsByDate.set(key, [event]);
    }
  }

  const monthLabel = monthDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className={cn("bg-card", "border", "rounded-xl", "p-5", "flex", "flex-col", "gap-4")}>
      {/* Header */}
      <div className={cn("flex", "items-center", "justify-between")}>
        <div className={cn("flex", "items-center", "gap-2")}>
          <Calendar weight="BoldDuotone" className={cn("h-5", "w-5", "text-muted-foreground")} />
          <div>
            <h2 className={cn("text-base", "font-semibold", "text-foreground")}>Kalender Event</h2>
            <p className={cn("text-xs", "text-muted-foreground")}>{monthLabel}</p>
          </div>
        </div>
        <Link
          href="/dashboard/calendar-events"
          className={cn("inline-flex", "items-center", "gap-1", "rounded-full", "bg-muted", "px-3", "py-1.5", "text-xs", "font-medium", "text-foreground", "transition-colors", "hover:bg-accent")}
        >
          Lihat selengkapnya
          <AltArrowRight weight="BoldDuotone" className={cn("h-3.5", "w-3.5")} />
        </Link>
      </div>

      {/* Mini month grid */}
      <div className={cn("overflow-hidden", "rounded-lg", "border", "border-border")}>
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

        <div className={cn("grid", "grid-cols-7")}>
          {days.map((day) => {
            const dayEvents = eventsByDate.get(day.toDateString()) ?? [];
            const visible = dayEvents.slice(0, 3);
            const remaining = dayEvents.length - visible.length;
            const sameMonth = isSameMonth(day, monthDate);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-16 border-b border-r border-border p-1 last-of-type:border-r-0",
                  !sameMonth && "bg-muted/20",
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
                    <span className={cn("text-[10px]", "text-muted-foreground")}>+{remaining} lagi</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
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
    </div>
  );
}
