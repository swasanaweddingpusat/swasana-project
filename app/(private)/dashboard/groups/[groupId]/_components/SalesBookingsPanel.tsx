"use client";

import React from "react";
import { Crown, Target, Dollar, GraphUp, GraphDown } from "@solar-icons/react";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { cn } from "@/lib/utils";
import { SalesBookingsTable } from "./SalesBookingsTable";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SalesBookingsPanelMetrics {
  /** Revenue confirmed (Rp) */
  actual: number;
  /** Sales target (Rp) */
  target: number;
  /** Number of bookings pending manager/finance approval */
  pendingApproval: number;
  /** Rank within the group (1 = top performer) */
  rank: number;
}

export interface SalesBookingsPanelProps {
  salesId: string;
  salesName: string;
  avatarUrl?: string;
  metrics?: SalesBookingsPanelMetrics;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRpFull(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatRpShort(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function calcAchievement(actual: number, target: number): number {
  if (target === 0) return 0;
  return Math.round((actual / target) * 100);
}

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "positive" | "negative";
  icon?: React.ReactNode;
}

function MetricCard({ label, value, sub, variant = "default", icon }: MetricCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "relative rounded-2xl p-4 overflow-hidden",
        variant === "positive"
          ? "bg-gradient-to-br from-secondary/60 via-secondary/30 to-background ring-1 ring-border/60 shadow-sm"
          : variant === "negative"
            ? "bg-destructive/5 ring-1 ring-destructive/20 shadow-sm"
            : "bg-card ring-1 ring-border/50 shadow-sm",
      )}
    >
      {icon && (
        <div className="absolute top-3 right-3 pointer-events-none opacity-20">
          {icon}
        </div>
      )}
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-bold leading-tight truncate font-heading",
          variant === "positive" && "text-foreground",
          variant === "negative" && "text-destructive",
          variant === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesBookingsPanel({
  salesId,
  salesName,
  avatarUrl,
  metrics,
}: SalesBookingsPanelProps): React.JSX.Element {
  const isTop = metrics?.rank === 1;
  const pct = metrics ? calcAchievement(metrics.actual, metrics.target) : null;
  const overTarget =
    metrics !== undefined &&
    metrics.actual >= metrics.target &&
    metrics.target > 0;

  return (
    <div className="flex flex-col gap-5 p-5 md:p-6">
      {/* ── Header: avatar + name ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <ProfileAvatar name={salesName} src={avatarUrl} size="lg" />
          {isTop && (
            <Crown
              weight="BoldDuotone"
              className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 text-[var(--brand-gold)] drop-shadow-sm"
              aria-label="Top performer"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-foreground leading-snug truncate font-heading">
            {salesName}
          </h2>
          {isTop && (
            <span className="inline-flex mt-0.5 text-[10px] font-semibold bg-foreground text-background px-2 py-0.5 rounded-full">
              Top Performer
            </span>
          )}
        </div>

        {/* Achievement pill — quick glance */}
        {pct !== null && (
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums font-heading leading-none",
                pct >= 100
                  ? "text-foreground"
                  : pct >= 70
                    ? "text-muted-foreground"
                    : "text-destructive",
              )}
            >
              {pct}%
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {overTarget ? (
                <GraphUp weight="BoldDuotone" className="h-3 w-3 text-foreground" />
              ) : (
                <GraphDown weight="BoldDuotone" className="h-3 w-3 text-muted-foreground" />
              )}
              achievement
            </span>
          </div>
        )}
      </div>

      {/* ── Metrics grid ──────────────────────────────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Target"
            value={metrics.target > 0 ? formatRpShort(metrics.target) : "—"}
            sub={metrics.target > 0 ? formatRpFull(metrics.target) : "Belum diset"}
            icon={<Target weight="BoldDuotone" className="h-8 w-8" />}
          />

          <MetricCard
            label="Penjualan"
            value={formatRpShort(metrics.actual)}
            sub={formatRpFull(metrics.actual)}
            variant={overTarget ? "positive" : "default"}
            icon={<Dollar weight="BoldDuotone" className="h-8 w-8" />}
          />

          {/* Progress bar spans full width */}
          <div className="col-span-2 rounded-2xl bg-card ring-1 ring-border/50 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Progress target
              </p>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums font-heading",
                  pct !== null && pct >= 100
                    ? "text-foreground"
                    : pct !== null && pct >= 70
                      ? "text-muted-foreground"
                      : "text-destructive",
                )}
              >
                {pct ?? 0}%
              </span>
            </div>

            <div
              className="w-full h-2.5 bg-muted rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress target ${pct ?? 0}%`}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  pct !== null && pct >= 100
                    ? "bg-foreground"
                    : pct !== null && pct >= 70
                      ? "bg-foreground/60"
                      : "bg-destructive",
                )}
                style={{ width: `${Math.min(pct ?? 0, 100)}%` }}
              />
            </div>

            {metrics.pendingApproval > 0 && (
              <p className="mt-2 text-[11px] text-destructive font-medium">
                {metrics.pendingApproval} booking menunggu approval
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Booking table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SalesBookingsTable salesId={salesId} />
      </div>
    </div>
  );
}
