"use client";

import { useEffect, useState } from "react";
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
  InfoCircle,
  CloseCircle,
} from "@solar-icons/react";
import { checkSlotAvailability } from "@/actions/booking-slot";
import type { LeadItem } from "@/lib/queries/leads";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealConfirmModalProps {
  lead: LeadItem | null;
  isProcessing?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "missing_data"; message: string }
  | { status: "conflict"; reason: string }
  | { status: "available" }
  | { status: "error"; message: string };

// Subset of CheckState that comes back from the async slot check.
type AsyncResult =
  | { status: "missing_data"; message: string }
  | { status: "conflict"; reason: string }
  | { status: "available" }
  | { status: "error"; message: string };

// ─── Component ────────────────────────────────────────────────────────────────

export function DealConfirmModal({
  lead,
  isProcessing,
  onConfirm,
  onClose,
}: DealConfirmModalProps) {
  // Async availability result, keyed by the lead it belongs to. Set ONLY inside
  // the fetch callback — never synchronously in the effect body — so the
  // `set-state-in-effect` rule stays satisfied. The "checking"/"missing_data"
  // states are derived during render instead of being stored.
  const [result, setResult] = useState<{ leadId: string; state: AsyncResult } | null>(null);

  useEffect(() => {
    if (!lead || !lead.venue?.id || !lead.eventDate) return;

    let cancelled = false;
    const leadId = lead.id;
    const category = lead.eventType?.category ?? lead.category;
    const session = lead.weddingSession ?? null;

    void checkSlotAvailability({
      venueId: lead.venue.id,
      eventDate: new Date(lead.eventDate).toISOString().split("T")[0],
      session,
      category,
    }).then((res) => {
      if (cancelled) return;
      if (!res.success) {
        setResult({ leadId, state: { status: "error", message: res.error ?? "Gagal memeriksa ketersediaan." } });
      } else if (!res.available) {
        // Use structured unavailableReason field — avoids fragile substring matching
        if (res.unavailableReason === "missing_session") {
          setResult({ leadId, state: { status: "missing_data", message: res.conflictReason ?? "Session belum diisi." } });
        } else {
          setResult({ leadId, state: { status: "conflict", reason: res.conflictReason ?? "Slot tidak tersedia." } });
        }
      } else {
        setResult({ leadId, state: { status: "available" } });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lead]);

  // Derive the display state from props + the async result (no setState in render).
  let checkState: CheckState;
  if (!lead) {
    checkState = { status: "idle" };
  } else if (!lead.venue?.id || !lead.eventDate) {
    checkState = {
      status: "missing_data",
      message:
        "Data lead belum lengkap. Venue dan tanggal event wajib diisi sebelum menandai Deal.",
    };
  } else if (result && result.leadId === lead.id) {
    checkState = result.state;
  } else {
    checkState = { status: "checking" };
  }

  const isOpen = !!lead;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandShake weight="BoldDuotone" className="h-5 w-5 text-foreground" />
            Tandai sebagai Deal
          </DialogTitle>
          <DialogDescription>
            Lead <strong>{lead?.name}</strong> akan ditandai sebagai Deal dan booking draft akan dibuat otomatis.
          </DialogDescription>
        </DialogHeader>

        {/* State content */}
        <div className="py-2">
          {checkState.status === "checking" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Mengecek ketersediaan slot...
            </div>
          )}

          {checkState.status === "missing_data" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <InfoCircle weight="BoldDuotone" className="h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Data lead belum lengkap</p>
              </div>
              <p className="text-xs text-amber-700 pl-6">{checkState.message}</p>
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
                Jika ada kendala terkait ini, silakan hubungi manager atau admin.
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
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <div className="flex items-center gap-2">
                <HandShake weight="BoldDuotone" className="h-4 w-4 shrink-0 text-green-700" />
                <p className="text-sm font-medium text-green-800">Slot tersedia</p>
              </div>
              <p className="text-xs text-green-700 mt-1 pl-6">
                Venue &amp; tanggal tersedia. Status lead akan diubah ke <strong>Deal</strong> dan booking draft akan dibuat otomatis.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {(checkState.status === "missing_data" ||
            checkState.status === "conflict" ||
            checkState.status === "error") ? (
            <Button type="button" variant="outline" onClick={onClose}>
              Tutup
            </Button>
          ) : (
            <>
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
                onClick={onConfirm}
                disabled={checkState.status !== "available" || isProcessing}
              >
                {isProcessing
                  ? "Memproses..."
                  : "Tandai Deal & Buat Booking"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
