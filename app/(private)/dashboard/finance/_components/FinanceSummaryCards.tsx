"use client";

import {
  Bill,
  Target as TargetIcon,
  Wallet,
  Dollar,
  CalendarMark,
} from "@solar-icons/react";
import type { CompanyFinanceSummary } from "@/lib/queries/finance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRp(n: number): string {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatRpFull(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

// ─── Donut ────────────────────────────────────────────────────────────────────

function AchievementDonut({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0"
      role="img"
      aria-label={`Achievement ${Math.round(pct)}%`}
    >
      <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="rgb(245 158 11 / 0.18)"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#finance-donut-gradient)"
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="finance-donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm sm:text-base font-bold tabular-nums text-amber-800">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

// ─── StatRow ──────────────────────────────────────────────────────────────────

type IconComponent = typeof Bill;

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-100/60 shrink-0">
        <Icon weight="BoldDuotone" className="h-4 w-4 text-amber-700" />
      </div>
      <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-base sm:text-lg font-semibold text-foreground tabular-nums truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  summary: CompanyFinanceSummary;
}

export function FinanceSummaryCards({ summary }: Props) {
  const { kasDiterima, piutang, nilaiKontrak, totalTarget, totalConfirmed, achievementPct } =
    summary;
  const sisa = Math.max(0, totalTarget - nilaiKontrak);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* ── Card 1: Summary + Piutang ── */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 ring-1 ring-amber-200/40 shadow-md shadow-amber-100/20 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Summary Company-Wide
        </p>
        <div className="space-y-2.5">
          <StatRow
            icon={CalendarMark}
            label="Booking Confirmed"
            value={totalConfirmed.toString()}
          />
        </div>

        {/* Piutang section */}
        <div className="mt-3 pt-3 border-t border-stone-200/70">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-orange-100/60 shrink-0">
                <Bill weight="BoldDuotone" className="h-3.5 w-3.5 text-orange-700" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Piutang</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">
                  TOP belum bayar + paid belum ack. Finance
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-heading text-base font-bold text-foreground tabular-nums leading-tight">
                {formatRp(piutang)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {formatRpFull(piutang)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Kas Diterima + Achievement Donut ── */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 ring-1 ring-amber-200/40 shadow-md shadow-amber-100/20 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <AchievementDonut pct={achievementPct} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <TargetIcon weight="BoldDuotone" className="h-3 w-3" /> Kas Diterima
            </p>
            <p className="font-heading text-lg sm:text-xl font-bold text-foreground leading-tight tabular-nums mt-0.5 truncate">
              {formatRpFull(kasDiterima)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              TOP paid &amp; di-acknowledge Finance · realisasi {achievementPct}% dari target
            </p>

            <div className="mt-3 pt-3 border-t border-stone-200/70 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet weight="BoldDuotone" className="h-3 w-3" />
                  <span>Nilai Kontrak</span>
                </span>
                <span className="text-sm font-semibold text-amber-800 tabular-nums truncate">
                  {formatRp(nilaiKontrak)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/70 -mt-0.5">
                Harga paket booking Confirmed (belum tentu kas masuk)
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Dollar weight="BoldDuotone" className="h-3 w-3" /> Target
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums truncate">
                  {formatRp(totalTarget)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Sisa Target</span>
                <span className="text-sm font-semibold text-foreground tabular-nums truncate">
                  {formatRp(sisa)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
