'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';
import type {
  CalendarEventsResult,
  CalendarEventItem,
} from '@/lib/queries/calendar-events';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CalendarMonthViewProps {
  events: CalendarEventsResult;
  year: number;
  month: number;
  onDateClick: (date: Date) => void;
}

const DAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const SESSION_LABEL: Record<string, string> = {
  morning: 'Pagi',
  afternoon: 'Siang',
  evening: 'Malam',
  fullday: 'Full Day',
};

function getDotClass(status: string): string {
  if (status === 'Confirmed') return 'bg-primary';
  if (status === 'Canceled' || status === 'Rejected' || status === 'Lost')
    return 'bg-destructive';
  return 'bg-muted-foreground';
}

function getSessionLabel(session: string | null): string {
  return session ? (SESSION_LABEL[session] ?? 'Event') : 'Event';
}

export function CalendarMonthView({
  events,
  year,
  month,
  onDateClick,
}: CalendarMonthViewProps) {
  const date = new Date(year, month - 1, 1);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
      }),
    [year, month],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const event of events) {
      const key = new Date(event.bookingDate).toDateString();
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
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="grid grid-cols-7">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="border-b border-r px-2 py-1.5 text-center text-xs font-medium text-muted-foreground last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDate.get(day.toDateString()) ?? [];
          const visible = dayEvents.slice(0, 3);
          const remaining = dayEvents.length - 3;
          const sameMonth = isSameMonth(day, date);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDateClick(day)}
              className={cn(
                'min-h-24 cursor-pointer border-b border-r p-1.5 transition hover:bg-accent/50',
                today && 'rounded-lg ring-2 ring-primary',
              )}
            >
              <span
                className={cn(
                  'text-xs font-medium',
                  sameMonth ? 'text-foreground' : 'text-muted-foreground/40',
                )}
              >
                {day.getDate()}
              </span>

              <div className="mt-0.5 space-y-0.5">
                {visible.map((event) => (
                  <Tooltip key={event.id}>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 truncate">
                        <span
                          className={cn(
                            'size-1.5 shrink-0 rounded-full',
                            getDotClass(event.bookingStatus),
                          )}
                        />
                        <span
                          className={cn(
                            'truncate text-[10px] leading-tight',
                            sameMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground/40',
                          )}
                        >
                          {getSessionLabel(event.weddingSession)}{' · '}
                          {event.snapCustomer?.name ?? '—'}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {event.weddingSession ?? 'fullday'} —{' '}
                      {event.snapCustomer?.name ?? '—'} —{' '}
                      {event.snapVenue?.venueName ?? '—'}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {remaining > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{remaining} more
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
