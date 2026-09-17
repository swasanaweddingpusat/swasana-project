"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link as LinkIcon } from "@solar-icons/react";
import type { DailyActivityItem } from "@/lib/queries/daily-activity";
import { ProgressStatusBadge } from "./progress-status";

// ─── Daily Activity detail modal (read-only) ───────────────────────────────
//
// Shows the full DailyActivity record. Controlled by { item, open, onOpenChange }
// from the parent list/table — this component never mutates or fetches data.

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

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

function DetailField({ label, value, className }: DetailFieldProps): React.ReactElement {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>{item.companyName ?? "Tanpa nama perusahaan"}</DialogTitle>
            <ProgressStatusBadge status={item.progressStatus} />
          </div>
          <DialogDescription>Detail aktivitas sales.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <DetailField label="Sales" value={item.sales.fullName} />
          <DetailField label="Tanggal Aktivitas" value={formatDate(item.activityDate)} />
          <DetailField label="Segment" value={item.segment.name} />
          <DetailField label="Sumber Informasi" value={item.sourceOfInformation.name} />
          <DetailField label="Milestone" value={item.milestone} className="sm:col-span-2" />
          <DetailField label="Nama Kontak" value={displayValue(item.contactName)} />
          <DetailField label="No. Telepon" value={displayValue(item.phoneNumber)} />
          <DetailField label="Email" value={displayValue(item.email)} />
          <DetailField label="Bitrix ID" value={displayValue(item.bitrixId)} />
          <DetailField label="Lokasi / Link" value={renderLocation(item.location)} />
          <DetailField label="Tanggal Site Visit" value={formatDate(item.siteVisitAt)} />
          <DetailField
            label="Catatan"
            value={displayValue(item.notes)}
            className="sm:col-span-2"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
