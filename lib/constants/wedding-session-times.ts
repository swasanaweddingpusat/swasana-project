/**
 * Auto-fill time range untuk booking/quotation weddings berdasarkan session + type acara.
 * Format value: "HH.mm - HH.mm" (sesuai TimeRangePicker)
 */

export type WeddingSession = "morning" | "evening";
export type WeddingEventType = "akad" | "resepsi" | "akad-dan-resepsi";

export const WEDDING_SESSION_TIMES: Record<
  WeddingSession,
  Record<WeddingEventType, string>
> = {
  morning: {
    akad: "07.30 - 09.00",
    resepsi: "11.00 - 13.00",
    "akad-dan-resepsi": "07.30 - 13.00",
  },
  evening: {
    akad: "15.30 - 17.00",
    resepsi: "19.00 - 21.00",
    "akad-dan-resepsi": "15.30 - 21.00",
  },
};

export const WEDDING_SESSION_LABELS: Record<WeddingSession, string> = {
  morning: "Pagi",
  evening: "Malam",
};

export const WEDDING_EVENT_TYPE_LABELS: Record<WeddingEventType, string> = {
  akad: "Akad",
  resepsi: "Resepsi",
  "akad-dan-resepsi": "Akad dan Resepsi",
};

export function getWeddingTimeRange(
  session: WeddingSession | "",
  eventType: WeddingEventType | "",
): string {
  if (!session || !eventType) return "";
  return WEDDING_SESSION_TIMES[session]?.[eventType] ?? "";
}
