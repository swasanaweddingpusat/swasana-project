"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HandShake,
  DangerCircle,
  CloseCircle,
  Refresh,
  Buildings2,
  CalendarDate,
  ClockCircle,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { checkSlotAvailability } from "@/actions/booking-slot";
import { SessionPillRadio, type WeddingSession } from "./lead-form-fields";
import { useVenueAvailability } from "@/hooks/use-venue-availability";
import type { LeadItem } from "@/lib/queries/leads";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealSelection {
  venueId: string;
  eventDate: string; // "YYYY-MM-DD"
  session: WeddingSession;
}

interface DealConfirmModalProps {
  lead: LeadItem | null;
  isProcessing?: boolean;
  onConfirm: (selection: DealSelection) => void;
  onClose: () => void;
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "conflict"; reason: string }
  | { status: "available" }
  | { status: "error"; message: string };

// Keyed async result so stale results from previous selections are discarded.
type AsyncResult =
  | { key: string; state: Exclude<CheckState, { status: "idle" } | { status: "checking" }> }
  | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDateKey(date: Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr + "T00:00:00"), "d MMM yyyy", { locale: localeId });
  } catch {
    return dateStr;
  }
}

/** Derive available sessions from avail map — mirrors lead-form-fields.tsx logic. */
function getAvailableSessions(
  avail: Record<string, { morning: boolean; evening: boolean; fullday: boolean }> | undefined,
  dateStr: string,
): Set<WeddingSession> {
  const all = new Set<WeddingSession>(["morning", "evening", "fullday"]);
  if (!avail || !dateStr) return all;
  const slot = avail[dateStr];
  if (!slot) return all;
  const available = new Set<WeddingSession>();
  if (slot.morning) available.add("morning");
  if (slot.evening) available.add("evening");
  if (slot.fullday && slot.morning && slot.evening) available.add("fullday");
  return available;
}

// ─── VenuePill ────────────────────────────────────────────────────────────────

function VenuePill({
  id,
  name,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {name}
    </button>
  );
}

// ─── DatePill ─────────────────────────────────────────────────────────────────

function DatePill({
  dateStr,
  label,
  selected,
  onSelect,
}: {
  dateStr: string;
  label: string;
  selected: boolean;
  onSelect: (d: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(dateStr)}
      className={cn(
        "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DealConfirmModal({
  lead,
  isProcessing,
  onConfirm,
  onClose,
}: DealConfirmModalProps) {
  // ── Selection state ──────────────────────────────────────────────────────
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [selectedEventDate, setSelectedEventDate] = useState<string>(""); // "YYYY-MM-DD"
  const [selectedSession, setSelectedSession] = useState<WeddingSession | "">("");

  // Async availability result, keyed by "venueId|date|session" to discard stale results.
  // Set ONLY inside the fetch callback — never synchronously in effect body.
  const [asyncResult, setAsyncResult] = useState<AsyncResult>(null);

  // Track which lead the current selection belongs to — reset selection when lead changes.
  const initLeadIdRef = useRef<string | null>(null);

  // ── Availability map (for session pills) ────────────────────────────────
  const month = selectedVenueId && selectedEventDate
    ? selectedEventDate.slice(0, 7)
    : undefined;
  const { data: avail, isFetching: isAvailFetching } = useVenueAvailability(
    selectedVenueId || null,
    month,
  );

  // ── Init / reset selection when lead changes ─────────────────────────────
  // Use callback to avoid capturing stale state in the effect.
  const initSelection = useCallback((l: LeadItem) => {
    const primaryVenueId = l.venue?.id ?? "";
    const primaryDate = makeDateKey(l.eventDate);

    setSelectedVenueId(primaryVenueId);
    setSelectedEventDate(primaryDate);
    // Initialise session to lead's primary session (may be cleared if unavailable later).
    setSelectedSession((l.weddingSession as WeddingSession | null) ?? "");
    setAsyncResult(null);
  }, []);

  useEffect(() => {
    if (!lead) {
      initLeadIdRef.current = null;
      return;
    }
    if (lead.id !== initLeadIdRef.current) {
      initLeadIdRef.current = lead.id;
      initSelection(lead);
    }
  }, [lead, initSelection]);

  // ── Clear pre-selected session when it becomes unavailable ──────────────
  // Runs when avail map or date/venue change. Avoids leaving an unavailable session selected.
  useEffect(() => {
    if (!selectedSession || !selectedVenueId || !selectedEventDate || !avail) return;
    const available = getAvailableSessions(avail, selectedEventDate);
    if (!available.has(selectedSession)) {
      setSelectedSession("");
      setAsyncResult(null);
    }
  }, [avail, selectedEventDate, selectedVenueId, selectedSession]);

  // ── Re-run slot check when selection is complete ─────────────────────────
  useEffect(() => {
    if (!lead || !selectedVenueId || !selectedEventDate || !selectedSession) {
      setAsyncResult(null);
      return;
    }

    const key = `${selectedVenueId}|${selectedEventDate}|${selectedSession}`;
    const category = lead.eventType?.category ?? lead.category;

    let cancelled = false;

    void checkSlotAvailability({
      venueId: selectedVenueId,
      eventDate: selectedEventDate,
      session: selectedSession,
      category,
    }).then((res) => {
      if (cancelled) return;
      if (!res.success) {
        setAsyncResult({ key, state: { status: "error", message: res.error ?? "Gagal memeriksa ketersediaan." } });
      } else if (!res.available) {
        setAsyncResult({ key, state: { status: "conflict", reason: res.conflictReason ?? "Slot tidak tersedia." } });
      } else {
        setAsyncResult({ key, state: { status: "available" } });
      }
    });

    return () => { cancelled = true; };
  }, [lead, selectedVenueId, selectedEventDate, selectedSession]);

  // ── Derived check state ──────────────────────────────────────────────────
  let checkState: CheckState;
  const selectionKey = selectedVenueId && selectedEventDate && selectedSession
    ? `${selectedVenueId}|${selectedEventDate}|${selectedSession}`
    : null;

  if (!lead) {
    checkState = { status: "idle" };
  } else if (!selectedSession) {
    // Not yet "checking" — user still needs to pick a session
    checkState = { status: "idle" };
  } else if (asyncResult && asyncResult.key === selectionKey) {
    checkState = asyncResult.state;
  } else if (selectionKey) {
    checkState = { status: "checking" };
  } else {
    checkState = { status: "idle" };
  }

  // ── Build venue + date options ───────────────────────────────────────────
  const venueOptions: { id: string; name: string }[] = [];
  if (lead?.venue) venueOptions.push({ id: lead.venue.id, name: lead.venue.name });
  if (lead?.venueSecondary) venueOptions.push({ id: lead.venueSecondary.id, name: lead.venueSecondary.name });

  const primaryDate = makeDateKey(lead?.eventDate);
  const altDate = makeDateKey(lead?.eventDateAlt);
  const dateOptions: { dateStr: string; label: string }[] = [];
  if (primaryDate) dateOptions.push({ dateStr: primaryDate, label: formatDateDisplay(primaryDate) });
  if (altDate && altDate !== primaryDate) dateOptions.push({ dateStr: altDate, label: `${formatDateDisplay(altDate)} (Alt)` });

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleVenueSelect(id: string) {
    setSelectedVenueId(id);
    setAsyncResult(null);
    // Don't clear session here — let the availability effect handle it if unavailable
  }

  function handleDateSelect(dateStr: string) {
    setSelectedEventDate(dateStr);
    setAsyncResult(null);
    // Prefill session berdasarkan tanggal yang dipilih:
    //   - tanggal utama → pakai weddingSession dari lead
    //   - tanggal alt → pakai weddingSessionAlt dari lead
    if (lead) {
      const primaryDate = makeDateKey(lead.eventDate);
      if (dateStr === primaryDate) {
        setSelectedSession((lead.weddingSession as WeddingSession | null) ?? "");
      } else {
        setSelectedSession((lead.weddingSessionAlt as WeddingSession | null) ?? "");
      }
    }
  }

  function handleSessionChange(v: WeddingSession) {
    setSelectedSession(v);
    setAsyncResult(null);
  }

  function handleConfirm() {
    if (!selectedVenueId || !selectedEventDate || !selectedSession) return;
    onConfirm({ venueId: selectedVenueId, eventDate: selectedEventDate, session: selectedSession });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const isOpen = !!lead;
  const canConfirm =
    !!selectedVenueId &&
    !!selectedEventDate &&
    !!selectedSession &&
    checkState.status === "available" &&
    !isProcessing;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandShake weight="BoldDuotone" className="h-5 w-5 text-foreground" />
            Tandai sebagai Deal
          </DialogTitle>
          <DialogDescription>
            Pilih venue, tanggal, dan session untuk lead <strong>{lead?.name}</strong>.
            Booking draft akan dibuat berdasarkan pilihan ini.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-1">

          {/* ── VENUE pills ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Buildings2 weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground">Venue</span>
            </div>
            {venueOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Venue belum diisi pada lead ini.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {venueOptions.map((v) => (
                  <VenuePill
                    key={v.id}
                    id={v.id}
                    name={v.name}
                    selected={selectedVenueId === v.id}
                    onSelect={handleVenueSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── TANGGAL pills ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarDate weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground">Tanggal Event</span>
            </div>
            {dateOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tanggal event belum diisi pada lead ini.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {dateOptions.map((d) => (
                  <DatePill
                    key={d.dateStr}
                    dateStr={d.dateStr}
                    label={d.label}
                    selected={selectedEventDate === d.dateStr}
                    onSelect={handleDateSelect}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── SESSION pills ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <ClockCircle weight="BoldDuotone" className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground sr-only">Session</span>
            </div>
            <SessionPillRadio
              label="Session"
              required
              value={selectedSession}
              onChange={handleSessionChange}
              venueId={selectedVenueId || undefined}
              eventDate={selectedEventDate || undefined}
            />
          </div>

          {/* ── Availability loading indicator ───────────────────────────── */}
          {isAvailFetching && selectedVenueId && selectedEventDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Refresh weight="BoldDuotone" className="h-3.5 w-3.5 animate-spin shrink-0" />
              Memuat ketersediaan slot...
            </div>
          )}

          {/* ── Check state banner ──────────────────────────────────────── */}
          {checkState.status === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
              Mengecek ketersediaan slot...
            </div>
          )}

          {checkState.status === "conflict" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <DangerCircle weight="BoldDuotone" className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm font-medium text-destructive">Slot sudah tidak tersedia</p>
              </div>
              <p className="text-xs text-destructive/80 pl-6">{checkState.reason}</p>
              <p className="text-xs text-muted-foreground pl-6">
                Coba pilih tanggal atau session yang berbeda, atau hubungi manager.
              </p>
            </div>
          )}

          {checkState.status === "error" && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <CloseCircle weight="BoldDuotone" className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">{checkState.message}</p>
              </div>
            </div>
          )}

          {checkState.status === "available" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <HandShake weight="BoldDuotone" className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm font-medium text-primary">Slot tersedia</p>
              </div>
              <p className="text-xs text-muted-foreground mt-1 pl-6">
                Venue &amp; tanggal tersedia. Status lead akan diubah ke <strong>Deal</strong> dan booking draft akan dibuat.
              </p>
            </div>
          )}

        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {isProcessing ? "Memproses..." : "Tandai Deal & Buat Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
