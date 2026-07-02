import {
  CheckCircle,
  Refresh,
  Forbidden,
  MinusCircle,
  ClockCircle,
  Star,
  HandStars,
  ChefHatMinimalistic,
  MoneyBag,
  PresentationGraph,
} from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { APAckStatus, APCategory, APStatus } from "@/types/finance";

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

/* ─── Category meta ────────────────────────────────────────────────────────── */

export interface CategoryMeta {
  label: string;
  Icon: typeof CheckCircle;
}

export const AP_CATEGORY_META: Record<APCategory, CategoryMeta> = {
  "bonus-sales": { label: "Bonus Sales", Icon: Star },
  "fee-manager": { label: "Fee Manager", Icon: ChefHatMinimalistic },
  "tunjangan-wp": { label: "Tunjangan WP", Icon: HandStars },
  "general-expense": { label: "General Expense", Icon: MoneyBag },
  mice: { label: "MICE", Icon: PresentationGraph },
};

export const AP_CATEGORY_OPTIONS: { value: APCategory; label: string }[] = (
  Object.keys(AP_CATEGORY_META) as APCategory[]
).map((value) => ({ value, label: AP_CATEGORY_META[value].label }));

export function CategoryChip({ category }: { category: APCategory }) {
  const { label, Icon } = AP_CATEGORY_META[category];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary py-0.5 pl-1.5 pr-2 text-xs font-medium text-foreground">
      <Icon weight="BoldDuotone" className="size-3 text-muted-foreground" />
      {label}
    </span>
  );
}

/* ─── Status badges ────────────────────────────────────────────────────────── */

export interface BadgeConfig {
  label: string;
  bg: string;
  border: string;
  text: string;
  Icon: typeof CheckCircle;
}

export function getApStatusBadge(status: APStatus): BadgeConfig {
  const map: Record<APStatus, BadgeConfig> = {
    paid: { label: "Lunas", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    partial: { label: "Partial", bg: "bg-secondary", border: "border-border", text: "text-foreground", Icon: Refresh },
    unpaid: { label: "Belum Dibayar", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
    on_hold: { label: "On Hold", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: ClockCircle },
  };
  return map[status] ?? map.unpaid;
}

export function getApAckBadge(status: APAckStatus): BadgeConfig {
  const map: Record<APAckStatus, BadgeConfig> = {
    acknowledged: { label: "Acknowledged", bg: "bg-primary", border: "border-primary", text: "text-primary-foreground", Icon: CheckCircle },
    pending: { label: "Pending Ack", bg: "bg-secondary", border: "border-border", text: "text-muted-foreground", Icon: MinusCircle },
    rejected: { label: "Rejected", bg: "bg-destructive/10", border: "border-destructive/20", text: "text-destructive", Icon: Forbidden },
  };
  return map[status] ?? map.pending;
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
