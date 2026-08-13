"use client";

import {
  ClockCircle,
  DocumentText,
  CheckCircle,
  type IconProps,
} from "@solar-icons/react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SolarIcon = ForwardRefExoticComponent<
  Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>
>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionItem {
  id: string;
  icon: SolarIcon;
  title: string;
  description: string;
  count: number;
  accent: "destructive" | "gold" | "muted";
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const DUMMY_ACTIONS: ActionItem[] = [
  {
    id: "acknowledgment",
    icon: CheckCircle,
    title: "Menunggu Acknowledgment",
    description: "Termin yang sudah dikirim invoice, belum dikonfirmasi oleh klien",
    count: 7,
    accent: "gold",
  },
  {
    id: "unissued",
    icon: DocumentText,
    title: "Invoice Belum Terbit",
    description: "Termin sudah jatuh tempo tapi invoice belum dibuat",
    count: 4,
    accent: "muted",
  },
  {
    id: "overdue_today",
    icon: ClockCircle,
    title: "Overdue Hari Ini",
    description: "Invoice yang melewati batas waktu pembayaran hari ini",
    count: 2,
    accent: "destructive",
  },
];

// ─── ActionItem ───────────────────────────────────────────────────────────────

function ActionItemCard({ item }: { item: ActionItem }) {
  const { icon: Icon, title, description, count, accent } = item;

  const iconBg = cn(
    "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
    accent === "gold" && "bg-[var(--brand-gold)]/10",
    accent === "destructive" && "bg-destructive/10",
    accent === "muted" && "bg-muted",
  );

  const iconClass = cn(
    "h-4 w-4",
    accent === "gold" && "text-[var(--brand-gold)]",
    accent === "destructive" && "text-destructive",
    accent === "muted" && "text-muted-foreground",
  );

  const badgeClass = cn(
    "rounded-full text-xs font-semibold tabular-nums shrink-0",
    accent === "gold" &&
      "bg-[var(--brand-gold)]/15 text-[var(--brand-gold)] border-[var(--brand-gold)]/30",
    accent === "destructive" &&
      "bg-destructive/10 text-destructive border-destructive/30",
    accent === "muted" &&
      "bg-muted text-muted-foreground border-border",
  );

  return (
    <div className="flex items-start gap-3 py-3">
      <div className={iconBg}>
        <Icon weight="BoldDuotone" className={iconClass} />
      </div>
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground leading-tight">
            {title}
          </span>
          <Badge variant="outline" className={badgeClass}>
            {count}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground leading-snug">
          {description}
        </span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActionRequiredPanel() {
  const totalActions = DUMMY_ACTIONS.reduce((sum, a) => sum + a.count, 0);

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-sm flex flex-col gap-4 w-80 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Perlu Tindakan
        </h3>
        <Badge
          variant="outline"
          className="rounded-full text-xs font-semibold bg-[var(--brand-gold)]/10 text-[var(--brand-gold)] border-[var(--brand-gold)]/30"
        >
          {totalActions} item
        </Badge>
      </div>

      {/* Action items */}
      <div className="flex flex-col divide-y divide-border">
        {DUMMY_ACTIONS.map((item) => (
          <ActionItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
