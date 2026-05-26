'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { CalendarEventsResult } from '@/lib/queries/calendar-events';
import { CalendarCheck, CalendarClock, CalendarDays, CalendarRange } from 'lucide-react';
import { cn } from "../../../../../../lib/utils";

interface CalendarStatsProps {
  events: CalendarEventsResult;
}

const stats = [
  { label: 'Total Events', icon: CalendarDays, getValue: (e: CalendarEventsResult) => e.length },
  { label: 'Confirmed', icon: CalendarCheck, getValue: (e: CalendarEventsResult) => e.filter((ev) => ev.bookingStatus === 'Confirmed').length },
  { label: 'Pending', icon: CalendarClock, getValue: (e: CalendarEventsResult) => e.filter((ev) => ev.bookingStatus === 'Pending' || ev.bookingStatus === 'Uploaded').length },
  { label: 'Event Days', icon: CalendarRange, getValue: (e: CalendarEventsResult) => new Set(e.map((ev) => new Date(ev.bookingDate).toDateString())).size },
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
              <Icon className={cn('h-8', 'w-8', 'text-muted-foreground/50')} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
