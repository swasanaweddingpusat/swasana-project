'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { CalendarEventsResult } from '@/lib/queries/calendar-events';
import { CalendarMark, ClockCircle, Calendar } from '@solar-icons/react';
import { cn } from "@/lib/utils";

interface CalendarStatsProps {
  events: CalendarEventsResult;
}

const stats = [
  { label: 'Total Events', icon: Calendar, getValue: (e: CalendarEventsResult) => e.length },
  { label: 'Confirmed', icon: CalendarMark, getValue: (e: CalendarEventsResult) => e.filter((ev) => ev.bookingStatus === 'Confirmed').length },
  { label: 'Pending', icon: ClockCircle, getValue: (e: CalendarEventsResult) => e.filter((ev) => ev.bookingStatus === 'Pending' || ev.bookingStatus === 'Uploaded').length },
  { label: 'Event Days', icon: Calendar, getValue: (e: CalendarEventsResult) => new Set(e.filter((ev) => ev.eventDate).map((ev) => new Date(ev.eventDate!).toDateString())).size },
] as const;

export function CalendarStats({ events }: CalendarStatsProps) {
  return (
    <div className={cn('grid', 'grid-cols-2', 'md:grid-cols-4', 'gap-4', 'mb-6')}>
      {stats.map(({ label, icon: Icon, getValue }) => (
        <Card key={label}>
          <CardContent className='p-4'>
            <div className={cn('flex', 'items-center', 'justify-between')}>
              <div>
                <p className={cn('text-sm', 'text-muted-foreground')}>{label}</p>
                <p className={cn('text-2xl', 'font-bold')}>{getValue(events)}</p>
              </div>
              <Icon weight="BoldDuotone" className={cn('h-8', 'w-8', 'text-muted-foreground/50')} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
