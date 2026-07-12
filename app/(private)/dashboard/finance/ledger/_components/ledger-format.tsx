import {
  CheckCircle,
  ClockCircle,
  Forbidden,
  MinusCircle,
  AddCircle,
  PenNewSquare,
  Pen,
  CardReceive,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

/* ─── Local types (dipindahkan dari types/finance.ts) ───────────────────────── */

export type LedgerAckStatus = "pending" | "acknowledged" | "rejected";
export type LedgerActivityAction = "created" | "acknowledged" | "rejected" | "voided" | "edited";

/**
 * Satu baris riwayat transaksi (append-only). Bentuk FE — di-map dari
 * PaymentActivity di lib/queries/ledger.ts::getLedgerActivities.
 */
export interface LedgerActivity {
  id: string;
  action: LedgerActivityAction;
  actorName: string;
  actorRole: string | null;
  signatureDataUrl: string | null;
  note: string | null;
  createdAt: string;
}

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

/* ─── Ack status badges ────────────────────────────────────────────────────── */

export function getLedgerAckBadge(status: LedgerAckStatus): BadgeConfig {
  const map: Record<LedgerAckStatus, BadgeConfig> = {
    acknowledged: {
      label: "Terverifikasi",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: CheckCircle,
    },
    pending: {
      label: "Menunggu Verifikasi",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: ClockCircle,
    },
    rejected: {
      label: "Ditolak",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: Forbidden,
    },
  };
  return map[status] ?? map.pending;
}

/** Badge "Dibatalkan" untuk row void (selalu ditampilkan menimpa ackStatus). */
export function getVoidedBadge(): BadgeConfig {
  return {
    label: "Dibatalkan",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    text: "text-destructive",
    Icon: MinusCircle,
  };
}

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

/* ─── Cash In chip (semua row di cashbook = cash in) ───────────────────────── */

export function CashInChip(): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-1.5 pr-2 text-xs font-medium text-foreground">
      <CardReceive weight="BoldDuotone" className="size-3 text-muted-foreground" />
      Cash Masuk
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
  edited: { label: "Diedit", Icon: Pen, dot: "bg-secondary", text: "text-muted-foreground" },
};
