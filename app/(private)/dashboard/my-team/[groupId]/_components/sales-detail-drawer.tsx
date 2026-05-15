"use client";

import { useState, useTransition, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { X, Check, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { approveBooking } from "@/actions/my-team";
import type { SalesBookingItem } from "@/lib/queries/my-team";
import { BookingStatus } from "@prisma/client";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  memberId: string | null;
  memberName: string;
  memberAvatarUrl: string | null;
  memberTarget: number;
  memberActual: number;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_DOT: Record<string, string> = {
  [BookingStatus.Confirmed]: "bg-foreground",
  [BookingStatus.Pending]: "bg-muted-foreground",
  [BookingStatus.Canceled]: "bg-destructive",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesDetailModal({ memberId, memberName, memberAvatarUrl, memberTarget, memberActual, onClose }: Props) {
  const [bookings, setBookings] = useState<SalesBookingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!memberId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data: SalesBookingItem[] = await fetch(`/api/sales-bookings?salesId=${memberId}`).then((r) => r.json());
        if (!cancelled) setBookings(data);
      } catch (e: unknown) {
        console.error("[SalesDetailModal]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [memberId]);

  if (!memberId) return null;

  const pct = memberTarget > 0 ? Math.round((memberActual / memberTarget) * 100) : 0;

  function handleApprove() {
    if (!approveTarget || !signature) return;
    startTransition(async () => {
      const res = await approveBooking(approveTarget, signature);
      if (res.success) {
        setBookings((prev) => prev.map((b) => b.id === approveTarget ? { ...b, managerApprovedAt: new Date() } : b));
        toast.success("Booking disetujui");
        setApproveTarget(null);
        setSignature(null);
      } else {
        toast.error(res.error ?? "Terjadi kesalahan");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-black/40">
      <div className="bg-white w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b border-border sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3 flex-1 pr-4">
            <ProfileAvatar name={memberName} src={memberAvatarUrl ?? undefined} size="md" />
            <div>
              <h2 className="text-lg font-semibold">{memberName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">Target: {memberTarget > 0 ? formatRp(memberTarget) : "—"}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">Penjualan: {formatRp(memberActual)}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className={cn(
                  "text-xs font-semibold",
                  pct >= 100 ? "text-foreground" : pct >= 70 ? "text-muted-foreground" : "text-destructive"
                )}>{pct}%</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 mt-0.5 h-8 w-8 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20"
            aria-label="Close"
          >
            <X size={18} className="text-destructive" />
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto relative">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader className="[&_tr]:border-b-0">
                <TableRow className="border-b-2 border-border">
                  <TableHead className="px-4 sm:px-8 py-2 text-xs font-semibold text-muted-foreground text-center w-10 sticky top-0 bg-secondary z-[5]">No</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground sticky top-0 bg-secondary z-[5]">Customer</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell sticky top-0 bg-secondary z-[5]">Venue & PO</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell sticky top-0 bg-secondary z-[5]">Package</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell sticky top-0 bg-secondary z-[5]">Event Date</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground text-right sticky top-0 bg-secondary z-[5]">Amount</TableHead>
                  <TableHead className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center sticky top-0 bg-secondary z-[5]">Approval</TableHead>
                  <TableHead className="px-4 sm:px-8 py-2 text-xs font-semibold text-muted-foreground text-right sticky top-0 bg-secondary z-[5]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada booking pada periode ini
                    </TableCell>
                  </TableRow>
                ) : bookings.map((b, idx) => (
                  <TableRow key={b.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <TableCell className="px-4 sm:px-8 py-2.5 text-center text-xs text-muted-foreground">{idx + 1}</TableCell>

                    <TableCell className="px-2 py-2.5">
                      <div>
                        <p className="text-sm font-medium truncate">{b.snapCustomer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.snapCustomer?.mobileNumber ?? ""}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border text-[10px] font-medium bg-white">
                            <span className={cn("w-1 h-1 rounded-full mr-1", STATUS_DOT[b.bookingStatus] ?? "bg-muted-foreground")} />
                            {b.bookingStatus}
                          </span>
                          {b.paymentMethod && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-border bg-secondary text-[10px] font-medium text-muted-foreground">
                              {b.paymentMethod.bankName}
                            </span>
                          )}
                          {b.weddingSession && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
                              {b.weddingSession}
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-2.5 hidden sm:table-cell">
                      <div>
                        <span className="block text-sm font-medium truncate">{b.snapVenue?.venueName ?? "—"}</span>
                        {b.poNumber ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-36">
                            {b.poNumber}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">No PO</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="px-2 py-2.5 hidden sm:table-cell">
                      <Badge variant="secondary" className="text-[10px]">{b.snapPackage?.packageName ?? "—"}</Badge>
                    </TableCell>

                    <TableCell className="px-2 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                      {formatDate(b.bookingDate)}
                    </TableCell>

                    <TableCell className="px-2 py-2.5 text-right">
                      <span className="text-xs font-semibold">{formatRp(b.snapPackageVariant?.price ?? 0)}</span>
                    </TableCell>

                    <TableCell className="px-2 py-2.5 text-center">
                      {b.managerApprovedAt ? (
                        <Badge variant="default" className="text-[10px]">Approved</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Pending</Badge>
                      )}
                    </TableCell>

                    <TableCell className="px-4 sm:px-8 py-2.5 text-right">
                      {b.managerApprovedAt ? (
                        <Button size="xs" variant="ghost" className="gap-1 text-[10px]" onClick={() => toast.info("Fitur cetak PO segera hadir")}>
                          <Printer className="h-3 w-3" /> Cetak PO
                        </Button>
                      ) : (
                        <Button size="xs" variant="outline" className="gap-1 text-[10px]" onClick={() => { setApproveTarget(b.id); setSignature(null); }}>
                          <Check className="h-3 w-3" /> Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Signature Approval Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) { setApproveTarget(null); setSignature(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Approve Booking</DialogTitle>
          <p className="text-sm text-muted-foreground">Tanda tangan untuk menyetujui booking ini.</p>
          <div className="mt-3">
            <SignaturePad onSignature={setSignature} label="Tanda Tangan Manager" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setApproveTarget(null); setSignature(null); }}>Batal</Button>
            <Button className="flex-1 gap-1.5" disabled={!signature || isPending} onClick={handleApprove}>
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
