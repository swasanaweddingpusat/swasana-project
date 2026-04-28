'use client';

import type { CalendarEventsResult } from '@/lib/queries/calendar-events';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay } from 'date-fns';
import { CalendarX } from 'lucide-react';
import { cn } from "../../../../../../lib/utils";

interface CalendarDayViewProps {
  events: CalendarEventsResult;
  date: Date;
}

const SESSION_ORDER = ['morning', 'afternoon', 'evening', 'fullday'] as const;

const SESSION_LABELS: Record<string, string> = {
  morning: 'Pagi (Morning)',
  afternoon: 'Siang (Afternoon)',
  evening: 'Malam (Evening)',
  fullday: 'Full Day',
};

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'Confirmed') return 'default';
  if (status === 'Pending' || status === 'Uploaded') return 'secondary';
  if (status === 'Canceled' || status === 'Rejected' || status === 'Lost') return 'destructive';
  return 'secondary';
}

export function CalendarDayView({ events, date }: CalendarDayViewProps) {
  const dayEvents = events.filter((e) => isSameDay(new Date(e.bookingDate), date));

  const grouped = dayEvents.reduce<Record<string, CalendarEventsResult>>((acc, e) => {
    const key = e.weddingSession ?? 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const sessionKeys = [
    ...SESSION_ORDER.filter((s) => grouped[s]),
    ...(grouped['other'] ? ['other'] : []),
  ];

  return (
    <div className="space-y-6">
      <h2 className={cn('text-lg', 'font-bold')}>{format(date, 'EEEE, dd MMMM yyyy')}</h2>

      {dayEvents.length === 0 ? (
        <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-12', 'text-muted-foreground')}>
          <CalendarX className={cn('size-10', 'mb-2')} />
          <p className="text-sm">Tidak ada event di tanggal ini</p>
        </div>
      ) : (
        sessionKeys.map((session) => (
          <div key={session} className="space-y-3">
            <h3 className={cn('text-sm', 'font-semibold', 'text-muted-foreground')}>
              {SESSION_LABELS[session] ?? 'Lainnya'}
            </h3>
            {grouped[session]!.map((e) => (
              <Card key={e.id}>
                <CardContent className="p-4">
                  <div className={cn('flex', 'items-center', 'justify-between')}>
                    <div>
                      <p className="font-medium">{e.snapCustomer?.name}</p>
                      <p className={cn('text-sm', 'text-muted-foreground')}>
                        {e.snapVenue?.venueName} • {e.snapPackage?.packageName}
                      </p>
                    </div>
                    <div className={cn('flex', 'items-center', 'gap-2')}>
                      {e.weddingType && (
                        <Badge variant="outline" className="text-xs">
                          {e.weddingType}
                        </Badge>
                      )}
                      <Badge variant={getStatusVariant(e.bookingStatus)} className="text-xs">
                        {e.bookingStatus}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
