import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function buildPeriodKey(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

interface PeriodSelectorProps {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  yearsBack?: number;
  yearsForward?: number;
}

export function PeriodSelector({
  month,
  year,
  onMonthChange,
  onYearChange,
  yearsBack = 2,
  yearsForward = 2,
}: PeriodSelectorProps) {
  const now = new Date();
  const yearOptions = Array.from(
    { length: yearsBack + yearsForward + 1 },
    (_, i) => now.getFullYear() - yearsBack + i
  );

  return (
    <div className="flex items-center gap-2">
      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="rounded-full w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="rounded-full w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
