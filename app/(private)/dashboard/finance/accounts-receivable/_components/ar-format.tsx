import {
  CheckCircle,
  Refresh,
  Forbidden,
  MinusCircle,
  ClipboardCheck,
  FileSend,
  VerifiedCheck,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type {
  ARBookingStatus,
  ARInvoiceStatus,
  ARTerminAckStatus,
  ARTerminStatus,
} from "@/types/finance";

/* ─── Formatters ───────────────────────────────────────────────────────────── */

export function fmtRp(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

export function fmtDate(d: string): string {
  if (!d || d === "-") return "-";
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

/* ─── Status Badges ────────────────────────────────────────────────────────── */

export interface BadgeConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: typeof CheckCircle;
}

export function getTerminBadge(status: ARTerminStatus): BadgeConfig {
  const map: Record<ARTerminStatus, BadgeConfig> = {
    paid: { label: "Lunas", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    partial: { label: "Partial", bg: "bg-secondary", border: "border-border", text: "text-foreground", Icon: Refresh },
    overdue: { label: "Aging", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
    unpaid: { label: "Unpaid", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
    not_due_yet: { label: "Not Due Yet", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: MinusCircle },
  };
  return map[status];
}

export function getInvoiceBadge(status: ARInvoiceStatus): BadgeConfig {
  const map: Record<ARInvoiceStatus, BadgeConfig> = {
    paid: { label: "Paid", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    partial: { label: "Partial", bg: "bg-secondary", border: "border-border", text: "text-foreground", Icon: Refresh },
    unpaid: { label: "Unpaid", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
    unissued: { label: "Unissued", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: ClipboardCheck },
  };
  return map[status] ?? map.unissued;
}

export function getAckBadge(status: ARTerminAckStatus): BadgeConfig {
  const map: Record<ARTerminAckStatus, BadgeConfig> = {
    acknowledged: { label: "Acknowledged", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    pending: { label: "Pending Ack", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: MinusCircle },
    rejected: { label: "Rejected", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
  };
  return map[status] ?? map.pending;
}

/** Badge for a booking whose revenue was recognized in bulk (level client) — dummy/preview state, tracked client-side only. */
export function getRecognizedRevenueBadge(): BadgeConfig {
  return {
    label: "Pendapatan Diakui",
    bg: "bg-primary/10",
    border: "border-primary/20",
    text: "text-primary",
    Icon: VerifiedCheck,
  };
}

export function getBookingStatusBadge(status: ARBookingStatus): BadgeConfig {
  const map: Record<ARBookingStatus, BadgeConfig> = {
    Confirmed: { label: "Confirmed", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    Uploaded: { label: "Uploaded", bg: "bg-secondary", border: "border-primary/20", text: "text-primary", Icon: FileSend },
    Pending: { label: "Pending", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: MinusCircle },
    Rejected: { label: "Rejected", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
    Canceled: { label: "Canceled", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: MinusCircle },
    Lost: { label: "Lost", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
  };
  return map[status] ?? map.Pending;
}

export function StatusBadge({ config }: { config: BadgeConfig }): React.ReactElement {
  const { label, bg, border, text, Icon } = config;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border py-0.5 pl-1.5 pr-2 text-xs font-medium",
        bg,
        border,
        text,
      )}
    >
      <Icon weight="BoldDuotone" className="size-3" />
      {label}
    </span>
  );
}
