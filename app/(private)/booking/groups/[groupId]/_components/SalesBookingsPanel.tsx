"use client";

import React from "react";
import { Crown, GraphDown } from "@solar-icons/react";
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

// ─── Component ────────────────────────────────────────────────────────────────

export function SalesBookingsPanel({
  salesId,
  salesName,
  avatarUrl,
  metrics,
}: SalesBookingsPanelProps): React.JSX.Element {
  const isTop = metrics?.rank === 1;
  const pct = metrics ? calcAchievement(metrics.actual, metrics.target) : null;

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
      </div>

      {/* ── Goal Track — achievement (posisi sekarang) → target (garis finish) ──
          Dibaca kiri→kanan: seberapa jauh sales menuju target. Bar = progress-nya.
          achievement % dan progress target % itu angka yang sama, jadi ditampilkan
          sekali sebagai achievement; bar adalah visualisasinya. */}
      {metrics && pct !== null && (
        <div className="rounded-2xl bg-card ring-1 ring-border/50 shadow-sm p-4">
          <div className="flex items-end justify-between gap-3">
            {/* Achievement — posisi sekarang */}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Achievement
              </p>
              <p
                className={cn(
                  "text-3xl font-bold tabular-nums font-heading leading-none mt-1",
                  pct >= 100 ? "text-foreground" : pct >= 70 ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {pct}%
              </p>
            </div>

            {/* Target — garis finish */}
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Target
              </p>
              <p className="text-xl font-bold tabular-nums font-heading text-foreground leading-none mt-1 truncate">
                {metrics.target > 0 ? formatRpShort(metrics.target) : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {metrics.target > 0 ? formatRpFull(metrics.target) : "Belum diset"}
              </p>
            </div>
          </div>

          {/* Track — bar ngebentang antara achievement & target */}
          <div
            className="mt-3 w-full h-2 bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress target ${pct}%`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pct >= 100 ? "bg-foreground" : pct >= 70 ? "bg-foreground/60" : "bg-destructive",
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>

          {metrics.pendingApproval > 0 && (
            <p className="mt-2 flex items-center gap-1 text-[11px] text-destructive font-medium">
              <GraphDown weight="BoldDuotone" className="h-3 w-3 shrink-0" />
              {metrics.pendingApproval} booking menunggu approval
            </p>
          )}
        </div>
      )}

      {/* ── Booking table ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SalesBookingsTable salesId={salesId} />
      </div>
    </div>
  );
}
