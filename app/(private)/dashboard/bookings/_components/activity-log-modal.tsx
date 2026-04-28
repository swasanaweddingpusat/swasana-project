"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
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
  open: boolean;
  onClose: () => void;
  bookingId: string;
  customerName?: string;
}

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  created: { label: "Dibuat", color: "bg-green-100 text-green-700" },
  updated: { label: "Diubah", color: "bg-blue-100 text-blue-700" },
  deleted: { label: "Dihapus", color: "bg-red-100 text-red-700" },
};

const FIELD_LABEL: Record<string, string> = {
  bookingStatus: "Status Booking",
  paymentStatus: "Status Pembayaran",
  bookingDate: "Tanggal Event",
  salesId: "Sales PIC",
  fromSales: "Dari Sales",
  toSales: "Ke Sales",
  venueId: "Venue",
  packageId: "Paket",
  weddingSession: "Sesi",
  weddingType: "Tipe Acara",
  rejectionNotes: "Alasan Reject",
  lostReason: "Alasan Lost",
  paymentMethodId: "Metode Pembayaran",
};

export function ActivityLogModal({ open, onClose, bookingId, customerName }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!open || !bookingId) return;
    const id = ++fetchIdRef.current;

    fetch(`/api/bookings/${bookingId}/activity-logs`)
      .then((r) => { if (id === fetchIdRef.current) setLoading(true); return r.json(); })
      .then((data) => { if (id === fetchIdRef.current) setLogs(data ?? []); })
      .catch(() => { if (id === fetchIdRef.current) setLogs([]); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }, [open, bookingId]);

  const formatValue = (field: string, value: unknown): string => {
    if (value === null || value === undefined) return "-";
    const str = String(value);
    const isoDate = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}.*)?$/;
    if (isoDate.test(str)) {
      try { return format(new Date(str), "dd MMM yyyy"); } catch { return str; }
    }
    return str;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-4xl w-full rounded-2xl p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <DialogTitle className="text-lg font-semibold">Activity Log</DialogTitle>
            {customerName && <p className="text-sm text-gray-500 mt-0.5">{customerName}</p>}
          </div>
          <button onClick={onClose} className="rounded-full bg-red-100 hover:bg-red-200 p-1.5 transition-colors" aria-label="Close">
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] px-6 py-4">
          {loading ? (
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
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Belum ada activity log untuk booking ini.</div>
          ) : (
            <ol className="relative border-l border-gray-200 ml-3 space-y-6">
              {logs.map((log) => {
                const badge = ACTION_BADGE[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-600" };
                const changedFields = log.changes ? Object.keys(log.changes) : [];
                return (
                  <li key={log.id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-400" />
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                      <span className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-1">
                      {log.profile?.fullName ?? "System"}
                      {log.profile?.role?.name && (
                        <span className="ml-1.5 text-xs text-gray-400 font-normal capitalize">({log.profile.role.name})</span>
                      )}
                    </p>
                    {log.description && <p className="text-sm text-gray-600 mt-0.5">{log.description}</p>}
                    {changedFields.length > 0 && (
                      <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs space-y-1">
                        {changedFields.map((field) => {
                          const change = log.changes[field];
                          const isObj = change !== null && typeof change === "object" && !Array.isArray(change);
                          const from = isObj ? (change as Record<string, unknown>)?.from : undefined;
                          const to = isObj ? (change as Record<string, unknown>)?.to : undefined;
                          const direct = !isObj ? change : from === undefined && to === undefined ? change : undefined;
                          const label = FIELD_LABEL[field] ?? field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <div key={field} className="flex gap-1 flex-wrap">
                              <span className="font-medium text-gray-700">{label}:</span>
                              {from !== undefined && <span className="text-red-500 line-through">{formatValue(field, from)}</span>}
                              {to !== undefined && <span className="text-green-600">{formatValue(field, to)}</span>}
                              {direct !== undefined && <span className="text-gray-600">{formatValue(field, direct)}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
