"use client";

import {
  DollarMinimalistic,
  WalletMoney,
  Wallet,
  ClockCircle,
  ChartSquare,
  DocumentText,
  type IconProps,
} from "@solar-icons/react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { cn } from "@/lib/utils";

type SolarIcon = ForwardRefExoticComponent<
  Omit<IconProps, "ref"> & RefAttributes<SVGSVGElement>
>;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinanceKpi {
  totalAR: number;
  sudahTertagih: number;
  outstanding: number;
  overdue: number;
  collectionRate: number; // 0–100 (percent)
  invoiceBelumTerbit: number; // count
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(amount: number): string {
  if (amount >= 1_000_000_000)
    return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000)
    return `Rp ${(amount / 1_000_000).toFixed(0)}Jt`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

// ─── Config ───────────────────────────────────────────────────────────────────

type KpiKey = keyof FinanceKpi;

interface KpiCardConfig {
  key: KpiKey;
  label: string;
  Icon: SolarIcon;
  format: (v: number) => string;
  accent?: "gold" | "destructive" | "muted";
}

const KPI_CONFIG: KpiCardConfig[] = [
  {
    key: "totalAR",
    label: "Total AR",
    Icon: DollarMinimalistic,
    format: formatRupiah,
    accent: "muted",
  },
  {
    key: "sudahTertagih",
    label: "Sudah Tertagih",
    Icon: WalletMoney,
    format: formatRupiah,
    accent: "gold",
  },
  {
    key: "outstanding",
    label: "Outstanding",
    Icon: Wallet,
    format: formatRupiah,
    accent: "muted",
  },
  {
    key: "overdue",
    label: "Overdue",
    Icon: ClockCircle,
    format: formatRupiah,
    accent: "destructive",
  },
  {
    key: "collectionRate",
    label: "Collection Rate",
    Icon: ChartSquare,
    format: (v) => `${v.toFixed(1)}%`,
    accent: "gold",
  },
  {
    key: "invoiceBelumTerbit",
    label: "Invoice Belum Terbit",
    Icon: DocumentText,
    format: (v) => `${v} invoice`,
    accent: "muted",
  },
];

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ config, value }: { config: KpiCardConfig; value: number }) {
  const { label, Icon, format, accent } = config;

  const iconClass = cn(
    "h-5 w-5",
    accent === "gold" && "text-[var(--brand-gold)]",
    accent === "destructive" && "text-destructive",
    accent === "muted" && "text-muted-foreground",
  );

  const valueClass = cn(
    "text-2xl font-heading font-bold leading-none",
    accent === "destructive" && "text-destructive",
    (accent === "gold" || accent === "muted") && "text-foreground",
  );

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl p-6 flex flex-col gap-3 shadow-sm",
        "hover:shadow-md transition-shadow",
        "min-w-40 flex-1",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div
          className={cn(
            "h-8 w-8 rounded-xl flex items-center justify-center",
            accent === "gold" && "bg-[var(--brand-gold)]/10",
            accent === "destructive" && "bg-destructive/10",
            accent === "muted" && "bg-muted",
          )}
        >
          <Icon weight="BoldDuotone" className={iconClass} />
        </div>
      </div>
      <span className={valueClass}>{format(value)}</span>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function KpiCards({ kpi }: { kpi: FinanceKpi }) {
  return (
    <div className="flex flex-wrap gap-4">
      {KPI_CONFIG.map((config) => (
        <KpiCard key={config.key} config={config} value={kpi[config.key]} />
      ))}
    </div>
  );
}
