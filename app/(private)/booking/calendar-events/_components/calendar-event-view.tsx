'use client';

import { useCallback, useMemo, useState } from 'react';

import { Buildings2, Calendar } from '@solar-icons/react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import type { CalendarEventsResult } from '@/lib/queries/calendar-events';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarStats } from './calendar-stats';
import { CalendarMonthView } from './calendar-month-view';
import { CalendarWeekView } from './calendar-week-view';
import { CalendarDayView } from './calendar-day-view';

type ViewMode = 'month' | 'week' | 'day';

interface CalendarEventViewProps {
  initialData: CalendarEventsResult;
  initialYear: number;
  initialMonth: number;
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const YEARS = Array.from({ length: 31 }, (_, i) => 2020 + i);

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function CalendarEventView({
  initialData,
  initialYear,
  initialMonth,
}: CalendarEventViewProps) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [selectedVenue, setSelectedVenue] = useState<string>('all');

  const { data: events = [] } = useCalendarEvents(
    year,
    month,
    year === initialYear && month === initialMonth ? initialData : undefined,
  );

  const venueNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of events) {
      if (e.snapVenue?.venueName) names.add(e.snapVenue.venueName);
    }
    return [...names].sort();
  }, [events]);

  const filteredEvents = useMemo(() => {
    if (selectedVenue === 'all') return events;
    return events.filter((e) => e.snapVenue?.venueName === selectedVenue);
  }, [events, selectedVenue]);

  const handleVenueChange = useCallback((val: string) => {
    setSelectedVenue(val);
  }, []);

  function handleToday() {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setSelectedDate(now);
    setViewMode('day');
  }

  function handleDateClick(date: Date) {
    setSelectedDate(date);
    setViewMode('day');
  }

  const daysInMonth = getDaysInMonth(year, month);
  const defaultDate = selectedDate ?? new Date(year, month - 1, 1);

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
  ];

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className={cn('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-2')}>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          <Calendar weight="BoldDuotone" className={cn('size-5', 'text-muted-foreground')} />
          {/* Year select */}
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className={cn('w-24', 'h-9')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Month select */}
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className={cn('w-32', 'h-9')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Day select (optional — jumps to day view) */}
          <Select
            value={selectedDate && selectedDate.getMonth() + 1 === month && selectedDate.getFullYear() === year ? String(selectedDate.getDate()) : ''}
            onValueChange={(v) => {
              const d = new Date(year, month - 1, Number(v));
              setSelectedDate(d);
              setViewMode('day');
            }}
          >
            <SelectTrigger className={cn('w-20', 'h-9')}>
              <SelectValue placeholder="Tgl" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                <SelectItem key={d} value={String(d)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hari Ini
          </Button>

          {/* Venue filter */}
          <Select value={selectedVenue} onValueChange={handleVenueChange}>
            <SelectTrigger className={cn('w-44', 'h-9')}>
              <div className={cn('flex', 'items-center', 'gap-1.5', 'truncate')}>
                <Buildings2 weight="BoldDuotone" className={cn('h-3.5', 'w-3.5', 'shrink-0', 'text-muted-foreground')} />
                <SelectValue placeholder="Semua Venue" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Venue</SelectItem>
              {venueNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn('flex', 'items-center', 'gap-1')}>
          {viewModes.map((vm) => (
            <Button
              key={vm.value}
              variant={viewMode === vm.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode(vm.value)}
              className={cn(viewMode !== vm.value && 'text-muted-foreground')}
            >
              {vm.label}
            </Button>
          ))}
        </div>
      </div>

      <CalendarStats events={filteredEvents} />

      {viewMode === 'month' && (
        <CalendarMonthView events={filteredEvents} year={year} month={month} onDateClick={handleDateClick} />
      )}
      {viewMode === 'week' && (
        <CalendarWeekView events={filteredEvents} year={year} month={month} selectedDate={defaultDate} onDateClick={handleDateClick} />
      )}
      {viewMode === 'day' && (
        <CalendarDayView events={filteredEvents} date={defaultDate} />
      )}
    </div>
  );
}
