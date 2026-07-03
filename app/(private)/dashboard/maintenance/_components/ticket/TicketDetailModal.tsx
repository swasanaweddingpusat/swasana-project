"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CloseCircle,
  Gallery,
  Calendar as CalendarDays,
} from "@solar-icons/react";
import type { MaintenanceTicketItem } from "@/lib/queries/maintenance";

type Tab = "detail" | "foto" | "aktivitas";

interface ActivityLog {
  id: string;
  action: string;
  result: string;
  description: string | null;
  createdAt: string;
  user: { fullName: string | null; nickName: string | null } | null;
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Mingguan",
  monthly: "Bulanan",
  quarterly: "Triwulan",
  yearly: "Tahunan",
};

function formatDate(
  date: Date | string | null | undefined,
  style: "short" | "long" = "short"
): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  if (style === "long")
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const lbl = "text-sm font-medium text-muted-foreground";
const val = "text-sm font-normal text-foreground";

interface TicketDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: MaintenanceTicketItem | null;
}

export function TicketDetailModal({
  open,
  onOpenChange,
  ticket,
}: TicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("detail");
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [prevTicketId, setPrevTicketId] = useState<string | null>(null);
  const [lastFetchKey, setLastFetchKey] = useState<string | null>(null);

  if (open && ticket && ticket.id !== prevTicketId) {
    setPrevTicketId(ticket.id);
    setActiveTab("detail");
    setActivities([]);
    setLastFetchKey(null);
  }
  if (!open && prevTicketId !== null) {
    setPrevTicketId(null);
  }

  const fetchKey = activeTab === "aktivitas" && ticket ? ticket.id : null;
  if (fetchKey && fetchKey !== lastFetchKey) {
    setLastFetchKey(fetchKey);
    setActivitiesLoading(true);
  }

  useEffect(() => {
    if (activeTab !== "aktivitas" || !ticket) return;
    let cancelled = false;
    fetch(`/api/maintenance/${ticket.id}/activity`)
      .then((r) => r.json())
      .then((data: ActivityLog[]) => {
        if (!cancelled) setActivities(data);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setActivitiesLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, ticket]);

  if (!open || !ticket) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "detail", label: "Detail" },
    { key: "foto", label: "Foto" },
    { key: "aktivitas", label: "Aktivitas" },
  ];

  const assignName =
    ticket.assignedTo?.fullName ?? ticket.assignedTo?.nickName ?? "—";
  const creatorName =
    ticket.createdBy?.fullName ?? ticket.createdBy?.nickName ?? "—";
  const isPreventive = ticket.type === "PREVENTIVE";

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center sm:justify-center sm:bg-black/40">
      <div
        className="bg-background w-full h-full flex flex-col sm:rounded-xl sm:shadow-lg sm:w-[70%] sm:max-w-[70%] overflow-hidden sm:h-auto sm:max-h-[90vh]"
        style={{ minWidth: 0 }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start px-4 sm:px-8 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-center gap-2 flex-1 pr-4">
            <h2 className="text-lg sm:text-xl font-semibold">
              {ticket.category.name} — {ticket.venue.name}
            </h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
            aria-label="Tutup"
          >
            <CloseCircle weight="BoldDuotone" className="h-6 w-6 text-destructive" />
          </button>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="flex border-b px-4 sm:px-8 shrink-0 overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 sm:px-6 py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 px-4 sm:px-8 py-4">

          {/* ═══ TAB: Detail ═══ */}
          {activeTab === "detail" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                {/* Col 1 */}
                <div>
                  <p className={lbl}>Venue</p>
                  <p className={val}>{ticket.venue.name}</p>
                  <p className={lbl + " mt-4"}>Brand</p>
                  <p className={val}>{ticket.venue.brand?.name ?? "—"}</p>
                  <p className={lbl + " mt-4"}>Estimasi</p>
                  <p className={val}>{formatDate(ticket.estimateDate)}</p>
                  <p className={lbl + " mt-4"}>Dibuat Oleh</p>
                  <p className={val}>{creatorName}</p>
                </div>
                {/* Col 2 */}
                <div>
                  <p className={lbl}>Kategori</p>
                  <p className={val}>{ticket.category.name}</p>
                  <p className={lbl + " mt-4"}>Prioritas</p>
                  <p className={val}>
                    {ticket.priority.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({ticket.priority.deadlineDays} hari)
                    </span>
                  </p>
                  {isPreventive && (
                    <>
                      <p className={lbl + " mt-4"}>Frekuensi</p>
                      <p className={val}>
                        {ticket.frequency
                          ? (FREQUENCY_LABELS[ticket.frequency] ?? ticket.frequency)
                          : "—"}
                      </p>
                      <p className={lbl + " mt-4"}>Jatuh Tempo</p>
                      <p className={val}>{formatDate(ticket.nextDueDate)}</p>
                    </>
                  )}
                  <p className={lbl + " mt-4"}>Dibuat</p>
                  <p className={val}>{formatDate(ticket.createdAt)}</p>
                  <p className={lbl + " mt-4"}>Diperbarui</p>
                  <p className={val}>{formatDate(ticket.updatedAt)}</p>
                </div>
                {/* Col 3 */}
                <div>
                  <p className={lbl}>Status</p>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {ticket.status.name}
                  </Badge>
                  <p className={lbl + " mt-4"}>Assign To</p>
                  <p className={val}>{assignName}</p>
                  <p className={lbl + " mt-4"}>Vendor</p>
                  <p className={val}>{ticket.isVendor ? "Ya" : "Tidak"}</p>
                  <p className={lbl + " mt-4"}>Audit</p>
                  <p className={val}>{ticket.isAudit ? "Ya" : "Tidak"}</p>
                </div>
              </div>

              {/* Deskripsi — full width */}
              <div className="border-t pt-4">
                <p className={lbl}>Deskripsi</p>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>
            </div>
          )}

          {/* ═══ TAB: Foto ═══ */}
          {activeTab === "foto" && (
            ticket.images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Gallery weight="BoldDuotone" className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Belum ada foto.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ticket.images.map((img) => (
                  <a
                    key={img.id}
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.fileName}
                      className="h-36 w-full rounded-lg object-cover border hover:opacity-90 transition-opacity"
                    />
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {img.fileName}
                    </p>
                  </a>
                ))}
              </div>
            )
          )}

          {/* ═══ TAB: Aktivitas ═══ */}
          {activeTab === "aktivitas" && (
            activitiesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-3.5 w-3.5 rounded-full mt-1 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <CalendarDays weight="BoldDuotone" className="h-10 w-10 mb-3 opacity-40" />
                <p className="text-sm">Belum ada aktivitas.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activities.map((log, idx) => (
                  <div key={log.id} className="flex gap-3 relative">
                    {idx < activities.length - 1 && (
                      <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border" />
                    )}
                    <div className="shrink-0 mt-1 h-3.5 w-3.5 rounded-full border-2 border-foreground bg-background z-10" />
                    <div className="pb-4 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {log.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.user?.fullName ?? log.user?.nickName ?? "Sistem"}{" "}
                        · {formatDate(log.createdAt, "long")}
                      </p>
                      {log.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {log.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
