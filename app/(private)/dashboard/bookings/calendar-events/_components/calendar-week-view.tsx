'use client';

import { useMemo } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
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

interface CalendarWeekViewProps {
  events: CalendarEventsResult;
  year: number;
  month: number;
  selectedDate: Date;
  onDateClick: (date: Date) => void;
}

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

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

export function CalendarWeekView({
  events,
  selectedDate,
  onDateClick,
}: CalendarWeekViewProps) {
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
      }),
    [selectedDate],
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
    <div className={cn('grid', 'grid-cols-7', 'gap-0', 'overflow-hidden', 'rounded-lg', 'border', 'bg-white')}>
      {weekDays.map((day, i) => {
        const dayEvents = eventsByDate.get(day.toDateString()) ?? [];
        const today = isToday(day);

        return (
          <div key={day.toISOString()} className={cn('flex', 'flex-col')}>
            {/* Header */}
            <div className={cn('border-b', 'bg-muted/50', 'px-2', 'py-2', 'text-center')}>
              <div className={cn('text-xs', 'text-muted-foreground')}>
                {DAY_NAMES[i]}
              </div>
              <div
                className={cn(
                  'mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm',
                  today && 'font-bold ring-2 ring-primary',
                )}
              >
                {day.getDate()}
              </div>
            </div>

            {/* Body */}
            <div
              className={cn(
                'min-h-64 space-y-1 p-2',
                i < 6 && 'border-r',
              )}
            >
              {dayEvents.length === 0 ? (
                <p className={cn('py-4', 'text-center', 'text-xs', 'text-muted-foreground')}>
                  Tidak ada event
                </p>
              ) : (
                dayEvents.map((event) => (
                  <Tooltip key={event.id}>
                    <TooltipTrigger>
                      <div
                        onClick={() => onDateClick(day)}
                        className={cn('cursor-pointer', 'rounded-md', 'border', 'px-2', 'py-1', 'text-xs', 'hover:bg-accent/50')}
                      >
                        <div className={cn('flex', 'items-center', 'gap-1.5')}>
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              getDotClass(event.bookingStatus),
                            )}
                          />
                          <span className="truncate">
                            {getSessionLabel(event.weddingSession)}{' · '}
                            {event.snapCustomer?.name ?? '—'}
                          </span>
                        </div>
                        <p className={cn('truncate', 'pl-3.5', 'text-muted-foreground')}>
                          {event.snapVenue?.venueName ?? '—'}
                        </p>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {event.weddingSession ?? 'fullday'} —{' '}
                      {event.snapCustomer?.name ?? '—'} —{' '}
                      {event.snapVenue?.venueName ?? '—'}
                    </TooltipContent>
                  </Tooltip>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
