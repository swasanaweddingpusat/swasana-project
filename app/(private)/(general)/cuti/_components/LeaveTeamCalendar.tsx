"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLeaveCalendar } from "@/hooks/use-leave-requests";
import { useDepartments } from "@/hooks/use-departments";
import { ArrowLeft, ArrowRight, UsersGroupRounded } from "@solar-icons/react";
import type { LeaveCalendarItem } from "@/lib/queries/leaveRequests";

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const ALL_DEPARTMENTS = "__all__";

function getMonthName(month: number): string {
  return new Date(2024, month).toLocaleDateString("id-ID", { month: "long" });
}

function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

function buildCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday=0 convention
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: CalendarDay[] = [];

  // Previous month padding
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({
      date: d,
      dayOfMonth: d.getDate(),
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }

  // Current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const d = new Date(year, month, day);
    days.push({
      date: d,
      dayOfMonth: day,
      isCurrentMonth: true,
      isToday: d.getTime() === today.getTime(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
  }

  // Next month padding to fill 6 rows or at least complete the week
  const totalCells = Math.ceil(days.length / 7) * 7;
  let nextDay = 1;
  while (days.length < totalCells) {
    const d = new Date(year, month + 1, nextDay);
    days.push({
      date: d,
      dayOfMonth: nextDay,
      isCurrentMonth: false,
      isToday: false,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    });
    nextDay++;
  }

  return days;
}

function getEntriesForDate(
  entries: LeaveCalendarItem[],
  date: Date
): LeaveCalendarItem[] {
  const target = date.getTime();
  return entries.filter((entry) => {
    const start = new Date(entry.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(entry.endDate);
    end.setHours(0, 0, 0, 0);
    return target >= start.getTime() && target <= end.getTime();
  });
}

export function LeaveTeamCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [departmentId, setDepartmentId] = useState(ALL_DEPARTMENTS);

  const { data: departments } = useDepartments();

  const firstDate = useMemo(() => toISODate(getFirstDayOfMonth(year, month)), [year, month]);
  const lastDate = useMemo(() => toISODate(getLastDayOfMonth(year, month)), [year, month]);

  const { data: calendarData, isLoading } = useLeaveCalendar({
    departmentId: departmentId === ALL_DEPARTMENTS ? undefined : departmentId,
    startDate: firstDate,
    endDate: lastDate,
  });

  const calendarDays = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  function handlePrevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="font-heading text-lg flex items-center gap-2">
            <UsersGroupRounded weight="BoldDuotone" className="h-5 w-5" />
            Kalender Tim
          </CardTitle>

          <div className="flex items-center gap-3">
            <Select
              value={departmentId}
              onValueChange={setDepartmentId}
            >
              <SelectTrigger className="w-full sm:w-44 rounded-xl">
                <SelectValue placeholder="Semua Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DEPARTMENTS}>Semua Departemen</SelectItem>
                {departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handlePrevMonth}
              >
                <ArrowLeft weight="BoldDuotone" className="h-4 w-4" />
              </Button>
              <span className="min-w-36 text-center text-sm font-medium">
                {getMonthName(month)} {year}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={handleNextMonth}
              >
                <ArrowRight weight="BoldDuotone" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <Skeleton className="h-96 w-full rounded-xl" />
        )}

        {!isLoading && (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="grid grid-cols-7 gap-px min-w-[640px]">
              {/* Header */}
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}

              {/* Calendar cells */}
              {calendarDays.map((day, idx) => {
                const entries = calendarData
                  ? getEntriesForDate(calendarData, day.date)
                  : [];

                return (
                  <div
                    key={idx}
                    className={`min-h-20 rounded-lg border p-1 ${
                      !day.isCurrentMonth ? "bg-muted/30" : ""
                    } ${day.isWeekend ? "bg-muted/20" : ""} ${
                      day.isToday ? "ring-2 ring-ring" : ""
                    }`}
                  >
                    <span
                      className={`text-xs font-medium ${
                        !day.isCurrentMonth
                          ? "text-muted-foreground/50"
                          : day.isToday
                            ? "text-primary font-bold"
                            : "text-foreground"
                      }`}
                    >
                      {day.dayOfMonth}
                    </span>
                    {entries.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {entries.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] leading-tight text-primary"
                            title={`${entry.profile.fullName} - ${entry.leaveType.name}`}
                          >
                            {entry.profile.fullName}
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <p className="text-[10px] text-muted-foreground">
                            +{entries.length - 3} lagi
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
