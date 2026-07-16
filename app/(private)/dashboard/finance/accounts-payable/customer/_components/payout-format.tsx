import {
  CheckCircle,
  Forbidden,
  ClockCircle,
  TagPrice,
  WalletMoney,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";

/* ─── Re-export formatters from ap-format ────────────────────────────────────── */

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

/* ─── Badge types ────────────────────────────────────────────────────────────── */

export interface BadgeConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: typeof CheckCircle;
}

/* ─── StatusBadge component ──────────────────────────────────────────────────── */

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

/* ─── Payout type badge ──────────────────────────────────────────────────────── */

export type PayoutType = "program_cashback" | "overpay_refund";

export function getPayoutTypeBadge(type: PayoutType): BadgeConfig {
  const map: Record<PayoutType, BadgeConfig> = {
    program_cashback: {
      label: "Cashback Program",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-foreground",
      Icon: TagPrice,
    },
    overpay_refund: {
      label: "Refund Overpay",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: WalletMoney,
    },
  };
  return map[type] ?? map.program_cashback;
}

/* ─── Payout status badge ────────────────────────────────────────────────────── */

export type PayoutStatus = "outstanding" | "paid" | "void";

export function getPayoutStatusBadge(status: PayoutStatus): BadgeConfig {
  const map: Record<PayoutStatus, BadgeConfig> = {
    outstanding: {
      label: "Outstanding",
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      Icon: ClockCircle,
    },
    paid: {
      label: "Dicairkan",
      bg: "bg-primary",
      border: "border-primary",
      text: "text-primary-foreground",
      Icon: CheckCircle,
    },
    void: {
      label: "Dibatalkan",
      bg: "bg-secondary",
      border: "border-border",
      text: "text-muted-foreground",
      Icon: Forbidden,
    },
  };
  return map[status] ?? map.outstanding;
}
