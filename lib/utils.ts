import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number | null | undefined): string {
  if (amount == null) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }
): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", options).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generatePoNumber(prefix: string = "PO"): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}/${year}${month}${day}/${random}`;
}

/**
 * Converts a Date object to a "yyyy-MM-dd" string using LOCAL calendar getters.
 * This is the canonical way to encode a user-picked date-only value.
 * The date the user sees in the calendar (June 15) is what gets stored,
 * regardless of the client's timezone offset.
 *
 * Use this for eventDate (wedding/MICE event date) — NOT for timestamps or dueDates
 * that legitimately need a full datetime.
 */
export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parses a "yyyy-MM-dd" date-only string to a Date object using LOCAL noon (12:00:00).
 * Avoids the UTC-midnight parse ambiguity where `new Date("2026-06-15")` returns
 * UTC midnight, which in WIB/UTC+7 still shows June 15 but in UTC-X timezones could
 * appear as June 14.
 *
 * Use this to feed a "yyyy-MM-dd" string into a Calendar component's `selected` prop
 * or `defaultMonth` so the displayed date always matches the stored date string.
 */
export function parseDateOnly(dateOnly: string): Date {
  // Split into parts and construct using local clock, not UTC parse
  const [y, mo, d] = dateOnly.split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

const TERBILANG_SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

/** Recursively spells a non-negative integer below 1 trillion in Indonesian. */
function spell(n: number): string {
  if (n < 12) return TERBILANG_SATUAN[n];
  if (n < 20) return `${spell(n - 10)} belas`;
  if (n < 100) return `${spell(Math.floor(n / 10))} puluh ${spell(n % 10)}`.trim();
  if (n < 200) return `seratus ${spell(n - 100)}`.trim();
  if (n < 1000) return `${spell(Math.floor(n / 100))} ratus ${spell(n % 100)}`.trim();
  if (n < 2000) return `seribu ${spell(n - 1000)}`.trim();
  if (n < 1_000_000) return `${spell(Math.floor(n / 1000))} ribu ${spell(n % 1000)}`.trim();
  if (n < 1_000_000_000) return `${spell(Math.floor(n / 1_000_000))} juta ${spell(n % 1_000_000)}`.trim();
  return `${spell(Math.floor(n / 1_000_000_000))} miliar ${spell(n % 1_000_000_000)}`.trim();
}

/**
 * Spells a rupiah amount in Indonesian words, suffixed "rupiah" and capitalized.
 * e.g. 1500000 → "Satu juta lima ratus ribu rupiah". Used on kwitansi/receipt.
 */
export function terbilang(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return "Nol rupiah";
  const words = spell(Math.floor(amount)).replace(/\s+/g, " ").trim();
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} rupiah`;
}
