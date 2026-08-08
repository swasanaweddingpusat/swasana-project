"use client";

/**
 * Shared sub-components used by both CreateLeadDrawer and lead-drawer (edit).
 * Keep these pure/presentational — no server actions, no TanStack mutation here.
 */

import React, { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CalendarDate,
  Refresh,
  type IconProps,
} from "@solar-icons/react";
import { useVenueAvailability } from "@/hooks/use-venue-availability";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type WeddingSession = "morning" | "evening" | "fullday";

// ─── Constants ─────────────────────────────────────────────────────────────────

export const SESSION_OPTIONS: { id: WeddingSession; name: string }[] = [
  { id: "morning", name: "Pagi (Morning)" },
  { id: "evening", name: "Malam (Evening)" },
  { id: "fullday", name: "Full Day" },
];

// ─── Currency helpers ──────────────────────────────────────────────────────────

export function fmtCurrency(value: number): string {
  if (!value) return "";
  return value.toLocaleString("id-ID");
}

export function parseCurrency(value: string): number {
  return parseInt(value.replace(/\D/g, ""), 10) || 0;
}

// ─── Map event type code → WeddingEventType ───────────────────────────────────

import type { WeddingEventType } from "@/lib/constants/wedding-session-times";

export function mapCodeToWeddingEventType(code: string): WeddingEventType | "" {
  if (code === "R") return "resepsi";
  if (code === "AR") return "akad-dan-resepsi";
  if (code === "A") return "akad";
  return "";
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────

export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border">
      <Icon weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

// ─── SessionPillRadio ──────────────────────────────────────────────────────────

/**
 * Availability-aware session pill selector.
 *
 * When `venueId` + `eventDate` are provided, fetches venue availability for
 * that month and disables sessions that are already taken.
 *
 * Fullday is only available when BOTH morning AND evening are free
 * (same logic as booking-drawer.tsx `getAvailableSessions`).
 *
 * `excludeLeadId` allows the Deal confirm modal to exclude the lead being
 * converted so it doesn't block its own slot in the session pills.
 */
export function SessionPillRadio({
  label,
  required,
  value,
  onChange,
  venueId,
  eventDate,
  excludeLeadId,
}: {
  label: string;
  required?: boolean;
  value: WeddingSession | "";
  onChange: (v: WeddingSession) => void;
  /** Optional: venue ID for availability check */
  venueId?: string;
  /** Optional: "YYYY-MM-DD" for availability check */
  eventDate?: string;
  /** Optional: lead ID to exclude from locked-lead blocking (Deal modal). */
  excludeLeadId?: string;
}) {
  // Derive the YYYY-MM string from eventDate for the hook
  const month = eventDate ? eventDate.slice(0, 7) : undefined;

  const { data: avail, isFetching } = useVenueAvailability(
    venueId ?? null,
    month,
    undefined,
    excludeLeadId,
  );

  /**
   * Returns which sessions are available for `eventDate`.
   * Mirrors `getAvailableSessions` in booking-drawer.tsx.
   * Falls back to all available when map is not yet loaded or inputs are missing.
   */
  function getAvailableSessions(): Set<WeddingSession> {
    if (!venueId || !eventDate || !avail) {
      return new Set<WeddingSession>(["morning", "evening", "fullday"]);
    }
    const slot = avail[eventDate];
    if (!slot) {
      return new Set<WeddingSession>(["morning", "evening", "fullday"]);
    }
    const available = new Set<WeddingSession>();
    if (slot.morning) available.add("morning");
    if (slot.evening) available.add("evening");
    // fullday requires BOTH morning and evening to be free
    if (slot.fullday && slot.morning && slot.evening) available.add("fullday");
    return available;
  }

  const availableSessions = getAvailableSessions();
  const isAvailabilityActive = Boolean(venueId && eventDate);

  const LABELS: Record<WeddingSession, string> = {
    morning: "Pagi",
    evening: "Malam",
    fullday: "Full Day",
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <div className="flex gap-2 flex-wrap">
        {SESSION_OPTIONS.map((opt) => {
          const isUnavailable = isAvailabilityActive && !isFetching && !availableSessions.has(opt.id);
          const isSelected = value === opt.id;

          if (isUnavailable) {
            return (
              <button
                key={opt.id}
                type="button"
                disabled
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                  "cursor-not-allowed opacity-50",
                  "border-border text-muted-foreground bg-muted/30",
                )}
                title="Sesi ini sudah dipesan"
              >
                {LABELS[opt.id]}
              </button>
            );
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {LABELS[opt.id]}
            </button>
          );
        })}
      </div>
      {isFetching && isAvailabilityActive && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Refresh weight="BoldDuotone" className="h-3 w-3 animate-spin shrink-0" />
          Mengecek ketersediaan sesi...
        </p>
      )}
    </div>
  );
}

// ─── AvailabilityDatePickerField ───────────────────────────────────────────────

/** Date picker with built-in venue availability dots */
export function AvailabilityDatePickerField({
  label,
  required,
  value,
  onChange,
  placeholder,
  venueId,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  venueId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    value ? new Date(value + "T00:00:00") : new Date(),
  );

  const monthStr = format(visibleMonth, "yyyy-MM");

  const { data: avail, isFetching } = useVenueAvailability(
    venueId || null,
    monthStr,
  );

  function getDateStatus(d: Date): "available" | "partial" | "unavailable" | null {
    if (!venueId || !avail) return null;
    const key = format(d, "yyyy-MM-dd");
    const a = avail[key];
    if (!a) return null;
    const count = [a.morning, a.evening, a.fullday].filter(Boolean).length;
    if (count === 0) return "unavailable";
    if (count === 3) return "available";
    return "partial";
  }

  const disabled = !venueId;
  const displayDate = value
    ? format(new Date(value + "T00:00:00"), "d MMMM yyyy", { locale: localeId })
    : null;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal rounded-xl",
                !displayDate && "text-muted-foreground",
              )}
            >
              <CalendarDate weight="BoldDuotone" className="mr-2 h-4 w-4 shrink-0" />
              {disabled
                ? "Pilih venue dulu"
                : (displayDate ?? (placeholder ?? "Pilih tanggal..."))}
              {isFetching && venueId && (
                <Refresh weight="BoldDuotone" className="ml-auto h-3 w-3 animate-spin text-muted-foreground shrink-0" />
              )}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={value ? new Date(value + "T00:00:00") : undefined}
            onSelect={(date) => {
              if (date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
              } else {
                onChange("");
              }
              setOpen(false);
            }}
            disabled={(d) => getDateStatus(d) === "unavailable"}
            fromYear={new Date().getFullYear() - 1}
            toYear={new Date().getFullYear() + 5}
            defaultMonth={value ? new Date(value + "T00:00:00") : new Date()}
            onMonthChange={setVisibleMonth}
            modifiers={{
              available: (d) => !!venueId && getDateStatus(d) === "available",
              partial: (d) => !!venueId && getDateStatus(d) === "partial",
              unavailable: (d) => !!venueId && getDateStatus(d) === "unavailable",
            }}
            modifiersClassNames={{
              available: "day-available",
              partial: "day-partial",
              unavailable: "day-unavailable",
            }}
          />
          {value && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { onChange(""); setOpen(false); }}
              >
                Hapus tanggal
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── CurrencyInput ─────────────────────────────────────────────────────────────

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  id?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [localText, setLocalText] = useState("");

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        Rp
      </span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder ?? "0"}
        value={focused ? localText : fmtCurrency(value)}
        onFocus={() => {
          setLocalText(fmtCurrency(value));
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          const num = parseCurrency(raw);
          setLocalText(raw ? fmtCurrency(num) : "");
          onChange(num);
        }}
        className="pl-9 rounded-xl"
      />
    </div>
  );
}
