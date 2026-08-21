"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface ActivityLog {
  id: string;
  userId: string | null;
  action: string;
  result: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown>;
  description: string | null;
  createdAt: string;
  profile?: { fullName: string | null; role?: { name: string } | null } | null;
}

interface Props {
  bookingId: string;
  enabled?: boolean;
}

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  created: { label: "Dibuat", color: "bg-green-100 text-green-700" },
  updated: { label: "Diubah", color: "bg-blue-100 text-blue-700" },
  deleted: { label: "Dihapus", color: "bg-red-100 text-red-700" },
  "booking.draft_created": { label: "Draft Dibuat", color: "bg-gray-100 text-gray-600" },
  "booking.draft_updated": { label: "Draft Diubah", color: "bg-gray-100 text-gray-600" },
  "booking.finalized": { label: "Difinalisasi", color: "bg-green-100 text-green-700" },
  "booking.signature_saved": { label: "TTD Sales", color: "bg-blue-100 text-blue-700" },
  "booking.set_harga": { label: "Set Harga", color: "bg-blue-100 text-blue-700" },
  "booking.update_package_prices": { label: "Harga Diubah", color: "bg-blue-100 text-blue-700" },
  "booking.update_tc": { label: "S&K Diubah", color: "bg-blue-100 text-blue-700" },
  "booking.revision_restored": { label: "Revisi Dipulihkan", color: "bg-blue-100 text-blue-700" },
  "booking.package_synced": { label: "Paket Disinkron", color: "bg-blue-100 text-blue-700" },
  "booking.reset_approval": { label: "Approval Direset", color: "bg-red-100 text-red-700" },
  "booking.vendor_updated": { label: "Vendor Diubah", color: "bg-blue-100 text-blue-700" },
  "booking.bonus_added": { label: "Bonus Ditambah", color: "bg-green-100 text-green-700" },
  "booking.bonus_updated": { label: "Bonus Diubah", color: "bg-blue-100 text-blue-700" },
  "booking.bonus_deleted": { label: "Bonus Dihapus", color: "bg-red-100 text-red-700" },
  "booking.complimentary_added": { label: "Complimentary Ditambah", color: "bg-green-100 text-green-700" },
  "booking.complimentary_updated": { label: "Complimentary Diubah", color: "bg-blue-100 text-blue-700" },
  "booking.complimentary_deleted": { label: "Complimentary Dihapus", color: "bg-red-100 text-red-700" },
  "booking.comment_edited": { label: "Komentar Diubah", color: "bg-gray-100 text-gray-600" },
  "booking.comment_deleted": { label: "Komentar Dihapus", color: "bg-red-100 text-red-700" },
  "approval.approved": { label: "Disetujui", color: "bg-green-100 text-green-700" },
  "approval.rejected": { label: "Ditolak", color: "bg-red-100 text-red-700" },
  "client_agreement.sent": { label: "Link Dikirim", color: "bg-blue-100 text-blue-700" },
  "client_agreement.regenerated": { label: "Link Diperbarui", color: "bg-blue-100 text-blue-700" },
  "client_agreement.viewed": { label: "Dilihat Client", color: "bg-gray-100 text-gray-600" },
  "client_signed": { label: "Client TTD", color: "bg-green-100 text-green-700" },
};

const FIELD_LABEL: Record<string, string> = {
  bookingStatus: "Status Booking", paymentStatus: "Status Pembayaran", eventDate: "Tanggal Event",
  salesId: "Sales PIC", fromSales: "Dari Sales", toSales: "Ke Sales", venueId: "Venue",
  packageId: "Paket", weddingSession: "Sesi", weddingType: "Tipe Acara", eventTime: "Jam Acara",
  notes: "Catatan", rejectionNotes: "Alasan Reject", lostReason: "Alasan Lost",
  paymentMethodId: "Metode Pembayaran", sourceOfInformationId: "Sumber Informasi",
};

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "-";
  const str = String(value);
  const isoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;
  if (isoDate.test(str)) {
    try { return format(new Date(str), "dd MMM yyyy"); } catch { return str; }
  }
  return str;
}

export function ActivityLogTimeline({ bookingId, enabled = true }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !bookingId) return;
    const id = ++fetchIdRef.current;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings/${bookingId}/activity-logs`).then((r) => r.json());
        if (id === fetchIdRef.current) setLogs(Array.isArray(res) ? res : (res?.data ?? []));
      } catch {
        if (id === fetchIdRef.current) setLogs([]);
      } finally {
        if (id === fetchIdRef.current) setLoading(false);
      }
    })();
  }, [enabled, bookingId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Belum ada activity log untuk booking ini.</div>;
  }

  return (
    <ol className="relative border-l ml-3 space-y-6">
      {logs.map((log) => {
        const badge = ACTION_BADGE[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-600" };
        const changedFields = log.changes ? Object.keys(log.changes) : [];
        return (
          <li key={log.id} className="ml-4">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <div className="flex items-start gap-2 flex-wrap">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground mt-1">
              {log.profile?.fullName ?? "System"}
              {log.profile?.role?.name && (
                <span className="ml-1.5 text-xs text-muted-foreground font-normal">({log.profile.role.name})</span>
              )}
            </p>
            {log.description && <p className="text-sm text-muted-foreground mt-0.5">{log.description}</p>}
            {changedFields.length > 0 && (
              <div className="mt-2 rounded-lg bg-muted/50 border px-3 py-2 text-xs space-y-1">
                {changedFields.map((field) => {
                  const change = log.changes[field];
                  const isObj = change !== null && typeof change === "object" && !Array.isArray(change);
                  const from = isObj ? (change as Record<string, unknown>)?.from : undefined;
                  const to = isObj ? (change as Record<string, unknown>)?.to : undefined;
                  const direct = !isObj ? change : from === undefined && to === undefined ? change : undefined;
                  const label = FIELD_LABEL[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={field} className="flex gap-1 flex-wrap">
                      <span className="font-medium text-foreground">{label}:</span>
                      {from !== undefined && <span className="text-red-500 line-through">{formatValue(field, from)}</span>}
                      {to !== undefined && <span className="text-green-600">{formatValue(field, to)}</span>}
                      {direct !== undefined && <span className="text-muted-foreground">{formatValue(field, direct)}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
