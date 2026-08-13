"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClockCircle, Eye, RestartSquare, DangerTriangle } from "@solar-icons/react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn, formatRupiah, formatDateTime } from "@/lib/utils";
import { useBookingRevisions, useRestoreBookingRevision, type BookingRevisionItem } from "@/hooks/use-booking-revisions";
import type { BookingListItem } from "@/lib/queries/bookings";

interface Props {
  booking: BookingListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reuse the table's PO preview modal. Called with (booking, revisionId, label). */
  onPreviewPO: (booking: BookingListItem, revisionId: string, label: string) => void;
}

export function RevisionHistoryDrawer({ booking, open, onOpenChange, onPreviewPO }: Props) {
  const { data: revisions = [], isLoading } = useBookingRevisions(booking?.id ?? null, open);
  const restore = useRestoreBookingRevision();
  const [confirmTarget, setConfirmTarget] = useState<BookingRevisionItem | null>(null);

  // Money guard: enforcement is authoritative on the server (restoreBookingRevision
  // checks acked Ledger allocations — §6.6, pure-derived). Fase 5 dropped the legacy
  // TOP.paymentStatus/ackStatus signal from this client payload, so we no longer
  // pre-disable here; the server returns a clear error if a payment is recorded.
  const hasRecordedPayment = false;

  async function handleRestore(rev: BookingRevisionItem) {
    if (!booking) return;
    const res = await restore.mutateAsync({ bookingId: booking.id, revisionId: rev.id });
    if (!res.success) {
      toast.error(res.error ?? "Gagal me-restore versi.");
      return;
    }
    toast.success(`Versi Rev ${rev.revisionNumber} berhasil dijadikan versi aktif`);
    setConfirmTarget(null);
    onOpenChange(false);
  }

  return (
    <>
      <Drawer isOpen={open} onClose={() => onOpenChange(false)} title="Riwayat Versi" maxWidth="sm:max-w-lg">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground px-1">
            Tiap perubahan booking membuat versi baru. Versi lama tidak hilang — kamu bisa melihat PO tiap
            versi atau memakainya kembali sebagai versi aktif.
          </p>

          {hasRecordedPayment && (
            <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 p-3.5 text-sm text-destructive">
              <DangerTriangle weight="BoldDuotone" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Booking ini sudah punya pembayaran tercatat, jadi versi lama tidak bisa dijadikan aktif
                (restore). Kamu tetap bisa melihat PO tiap versi.
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-28 w-full rounded-2xl" />
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <ClockCircle weight="BoldDuotone" className="h-9 w-9" />
              <p className="text-sm">Belum ada riwayat versi.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {revisions.map((rev) => {
                const isActive = booking?.currentRevisionId === rev.id;
                return (
                  <li
                    key={rev.id}
                    className={cn(
                      "rounded-2xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
                      isActive && "border-primary/40 ring-1 ring-primary/20",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-heading text-lg font-semibold text-foreground">
                            Rev {rev.revisionNumber}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              Aktif
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {rev.packageName}
                          {rev.pax ? ` · ${rev.pax} PAX` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-heading text-base font-semibold text-foreground">
                          {formatRupiah(rev.price ?? 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(rev.createdAt)}</p>
                      </div>
                    </div>

                    {rev.reason && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80">{rev.reason}</p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full"
                        onClick={() => booking && onPreviewPO(booking, rev.id, `Rev ${rev.revisionNumber}`)}
                      >
                        <Eye weight="BoldDuotone" className="mr-1.5 h-4 w-4" />
                        Lihat PO
                      </Button>
                      {!isActive && (
                        <Button
                          type="button"
                          size="sm"
                          className="flex-1 rounded-full"
                          disabled={hasRecordedPayment || restore.isPending}
                          onClick={() => setConfirmTarget(rev)}
                        >
                          <RestartSquare weight="BoldDuotone" className="mr-1.5 h-4 w-4" />
                          Pakai versi ini
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        title={`Pakai Rev ${confirmTarget?.revisionNumber ?? ""} sebagai versi aktif?`}
        description={
          `Paket, harga, dan item booking akan dikembalikan ke isi Rev ${confirmTarget?.revisionNumber ?? ""}. ` +
          "Ini membuat versi baru (versi lama tetap tersimpan), me-reset approval ke Pending, dan klien harus " +
          "menandatangani ulang. Lanjutkan?"
        }
        confirmLabel={restore.isPending ? "Memproses..." : "Ya, pakai versi ini"}
        onConfirm={() => confirmTarget && handleRestore(confirmTarget)}
      />
    </>
  );
}
