export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 7, label: "Minggu" },
] as const;

export function normalizeOffdayDays(days: number[] | string[] | null | undefined): number[] {
  if (!days) return [];

  const normalized = Array.from(new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)));
  return normalized.sort((a, b) => a - b);
}

export function isOffdayForDate(days: number[] | string[] | null | undefined, date: Date): boolean {
  const normalized = normalizeOffdayDays(days);
  const dayOfWeek = date.getUTCDay() || 7;
  return normalized.includes(dayOfWeek);
}

export function formatOffdayDays(days: number[] | string[] | null | undefined): string {
  const normalized = normalizeOffdayDays(days);
  if (normalized.length === 0) return "-";

  return normalized.map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day).join(", ");
}

export function getWeekdayName(day: number): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? String(day);
}
