import {
  CheckCircle,
  ClockCircle,
  Wallet,
  Forbidden,
  MinusCircle,
  Bill,
  CardReceive,
  TagPrice,
  CardSend,
  Refresh,
  AddCircle,
  PenNewSquare,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type {
  LedgerAckStatus,
  LedgerActivityAction,
  LedgerEntryType,
  LedgerStatus,
} from "@/types/finance";

/* ─── Formatters ───────────────────────────────────────────────────────────── */

export function fmtRp(n: number): string {
  return `Rp${new Intl.NumberFormat("id-ID").format(n)}`;
}

export function fmtDate(d: string | null): string {
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

/** Format date header untuk group (mutation-list style): "12 JUL 2026" uppercase. */
export function fmtDateHeader(d: string): string {
  try {
    return new Date(d).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).toUpperCase();
  } catch {
    return d;
  }
}

/** Tanggal + jam untuk timeline activity log, e.g. "12 Jul 2026, 15.40". */
export function fmtDateTime(d: string): string {
  try {
    return new Date(d).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

/* ─── Badge config ─────────────────────────────────────────────────────────── */

export interface BadgeConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: typeof CheckCircle;
}

/* ─── Status badges ────────────────────────────────────────────────────────── */

export function getLedgerStatusBadge(status: LedgerStatus): BadgeConfig {
  const map: Record<LedgerStatus, BadgeConfig> = {
    receivable: {
      label: "Piutang",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: ClockCircle,
    },
    unearned: {
      label: "Unearned",
      bg: "bg-primary/40",
      border: "border-primary/30",
      text: "text-primary-foreground",
      Icon: Wallet,
    },
    earned: {
      label: "Earned",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: CheckCircle,
    },
    void: {
      label: "Void",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Forbidden,
    },
  };
  return map[status] ?? map.receivable;
}

export function getLedgerAckBadge(status: LedgerAckStatus): BadgeConfig {
  const map: Record<LedgerAckStatus, BadgeConfig> = {
    acknowledged: {
      label: "Acknowledged",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: CheckCircle,
    },
    pending: {
      label: "Pending",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: MinusCircle,
    },
    rejected: {
      label: "Rejected",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Forbidden,
    },
  };
  return map[status] ?? map.pending;
}

/* ─── Entry type meta (dengan icon field buat coin) ───────────────────────── */

export interface EntryTypeMeta {
  label: string;
  /** Icon buat EntryTypeChip & StatusBadge. */
  Icon: typeof CheckCircle;
}

export const LEDGER_ENTRY_TYPE_META: Record<LedgerEntryType, EntryTypeMeta> = {
  receivable: { label: "Piutang", Icon: Bill },
  cash_in: { label: "Cash Masuk", Icon: CardReceive },
  discount: { label: "Potongan", Icon: TagPrice },
  recognition: { label: "Recognition", Icon: CheckCircle },
  adjustment: { label: "Penyesuaian", Icon: Refresh },
  refund: { label: "Refund", Icon: CardSend },
};

/* ─── Badge component ──────────────────────────────────────────────────────── */

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

/* ─── Entry type chip ──────────────────────────────────────────────────────── */

export function EntryTypeChip({ type }: { type: LedgerEntryType }): React.ReactElement {
  const { label, Icon } = LEDGER_ENTRY_TYPE_META[type];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-1.5 pr-2 text-xs font-medium text-foreground">
      <Icon weight="BoldDuotone" className="size-3 text-muted-foreground" />
      {label}
    </span>
  );
}

/* ─── Activity log action meta (timeline dot + label) ──────────────────────── */

export interface ActivityActionMeta {
  label: string;
  Icon: typeof CheckCircle;
  /** Warna dot & icon — token only (no hardcode). */
  dot: string;
  text: string;
}

export const LEDGER_ACTIVITY_META: Record<LedgerActivityAction, ActivityActionMeta> = {
  created: { label: "Dicatat", Icon: AddCircle, dot: "bg-secondary", text: "text-muted-foreground" },
  acknowledged: { label: "Diverifikasi (Ack)", Icon: PenNewSquare, dot: "bg-primary", text: "text-primary" },
  rejected: { label: "Ditolak", Icon: Forbidden, dot: "bg-destructive/15", text: "text-destructive" },
  voided: { label: "Dibatalkan", Icon: MinusCircle, dot: "bg-destructive/15", text: "text-destructive" },
};
