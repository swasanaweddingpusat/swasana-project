"use client";

import { CalendarDate } from "@solar-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: number;
  onChange: (year: number) => void;
  /** Min year shown. Defaults to 2023. */
  minYear?: number;
  /** Max year shown. Defaults to currentYear + 3. */
  maxYear?: number;
}

export function GroupYearSelector({ value, onChange, minYear, maxYear }: Props) {
  const currentYear = new Date().getFullYear();
  const start = minYear ?? 2023;
  const end = maxYear ?? currentYear + 3;

  const years: number[] = [];
  for (let y = end; y >= start; y--) {
    years.push(y);
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDate weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v))}
      >
        <SelectTrigger className="h-9 w-28 rounded-full text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y === currentYear ? `${y} (ini)` : String(y)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
