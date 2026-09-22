"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, CloseCircle, Link as LinkIcon, MapPoint, UserRounded } from "@solar-icons/react";
import { BitrixDealDetail } from "@/components/shared/BitrixDealDetail";
import type { DailyActivityItem } from "@/lib/queries/daily-activity";
import { ProgressStatusBadge } from "./progress-status";

// ─── Daily Activity detail modal (read-only) ───────────────────────────────
//
// Shows the full DailyActivity record. Controlled by { item, open, onOpenChange }
// from the parent list/table — this component never mutates or fetches data.
// Chrome (header/close-button/card styling) mirrors booking-weddings/booking-detail-modal.tsx.

interface DailyActivityDetailModalProps {
  item: DailyActivityItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function displayValue(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

/** Lokasi field doubles as a link field — render as a clickable link when it looks like a URL. */
function renderLocation(value: string | null | undefined): React.ReactNode {
  const trimmed = value?.trim();
  if (!trimmed) return "—";
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  return (
    <a
      href={trimmed}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80 break-all"
    >
      <LinkIcon weight="BoldDuotone" className="w-3.5 h-3.5 shrink-0" />
      {trimmed}
    </a>
  );
}

/* ─── Local card/field helpers — adapted from booking-detail-modal.tsx's
   MobileCard/MobileField/lbl/val convention, co-located here since this is
   the only place they're needed for the Daily Activity feature. ────────── */

const lbl = "text-xs text-muted-foreground";
const val = "text-sm text-foreground whitespace-pre-wrap";

interface DetailCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function DetailCard({ title, icon, children }: DetailCardProps): React.ReactElement {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

function DetailField({ label, value, className }: DetailFieldProps): React.ReactElement {
  return (
    <div className={className}>
      <p className={lbl}>{label}</p>
      <p className={val}>{value}</p>
    </div>
  );
}

export function DailyActivityDetailModal({
  item,
  open,
  onOpenChange,
}: DailyActivityDetailModalProps): React.ReactElement {
  if (!item) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-2rem)] sm:max-w-2xl rounded-2xl p-0 overflow-hidden flex flex-col gap-0 max-h-[85vh]"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="truncate">
                  {item.companyName ?? "Tanpa nama perusahaan"}
                </DialogTitle>
                <ProgressStatusBadge status={item.progressStatus} />
              </div>
              <DialogDescription>Detail aktivitas sales.</DialogDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="shrink-0 h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center cursor-pointer bg-destructive/10 hover:bg-destructive/20 transition-colors"
              aria-label="Close"
            >
              <CloseCircle weight="BoldDuotone" className="h-5 w-5 sm:h-6 sm:w-6 text-destructive" />
            </button>
          </div>
        </DialogHeader>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto px-6 py-4 space-y-4">
          <DetailCard title="Aktivitas" icon={<ClipboardList weight="BoldDuotone" className="h-4 w-4" />}>
            <DetailField label="Sales" value={item.sales.fullName} />
            <DetailField label="Tanggal Aktivitas" value={formatDate(item.activityDate)} />
            <DetailField label="Segment" value={item.segment.name} />
            <DetailField label="Sumber Informasi" value={item.sourceOfInformation.name} />
            <DetailField label="Milestone" value={item.milestone} className="sm:col-span-2" />
          </DetailCard>

          <DetailCard title="Kontak" icon={<UserRounded weight="BoldDuotone" className="h-4 w-4" />}>
            <DetailField label="Nama Kontak" value={displayValue(item.contactName)} />
            <DetailField label="No. Telepon" value={displayValue(item.phoneNumber)} />
            <DetailField label="Email" value={displayValue(item.email)} className="sm:col-span-2" />
          </DetailCard>

          <DetailCard title="Lokasi & Catatan" icon={<MapPoint weight="BoldDuotone" className="h-4 w-4" />}>
            <DetailField label="Lokasi / Link" value={renderLocation(item.location)} />
            <DetailField label="Tanggal Site Visit" value={formatDate(item.siteVisitAt)} />
            <DetailField
              label="Catatan"
              value={displayValue(item.notes)}
              className="sm:col-span-2"
            />
          </DetailCard>

          {item.bitrixId?.trim() && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  <LinkIcon weight="BoldDuotone" className="h-4 w-4" />
                </span>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bitrix</p>
              </div>
              <BitrixDealDetail dealId={item.bitrixId.trim()} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
