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
  entryId: string;
  enabled?: boolean;
}

const ACTION_BADGE: Record<string, { label: string; color: string }> = {
  "guestbook_entry.create": { label: "Dibuat", color: "bg-green-100 text-green-700" },
  "guestbook_entry.update": { label: "Diubah", color: "bg-blue-100 text-blue-700" },
  "guestbook_entry.delete": { label: "Dihapus", color: "bg-red-100 text-red-700" },
  "guestbook_entry.checkout": { label: "Checkout", color: "bg-blue-100 text-blue-700" },
  "guestbook_entry.bulk_checkout": { label: "Checkout Massal", color: "bg-blue-100 text-blue-700" },
  "guestbook_entry.bulk_delete": { label: "Dihapus Massal", color: "bg-red-100 text-red-700" },
  "guestbook_entry.confirm_attendance": { label: "Kehadiran Dikonfirmasi", color: "bg-green-100 text-green-700" },
};

export function ActivityLogTimeline({ entryId, enabled = true }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !entryId) return;
    const id = ++fetchIdRef.current;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guestbook/${entryId}/activity-logs`).then((r) => r.json());
        if (id === fetchIdRef.current) setLogs(Array.isArray(res) ? res : (res?.data ?? []));
      } catch {
        if (id === fetchIdRef.current) setLogs([]);
      } finally {
        if (id === fetchIdRef.current) setLoading(false);
      }
    })();
  }, [enabled, entryId]);

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
    return <div className="text-center py-12 text-muted-foreground text-sm">Belum ada activity log untuk tamu ini.</div>;
  }

  return (
    <ol className="relative border-l ml-3 space-y-6">
      {logs.map((log) => {
        const badge = ACTION_BADGE[log.action] ?? { label: log.action, color: "bg-gray-100 text-gray-600" };
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
          </li>
        );
      })}
    </ol>
  );
}
