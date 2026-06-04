import {
  UsersGroupRounded,
  CalendarMark,
  Wallet,
  Target as TargetIcon,
  Bill,
  Dollar,
} from "@solar-icons/react";

interface Props {
  totalGroups: number;
  totalSales: number;
  totalTarget: number;
  avgAchievement: number;
  totalConfirmed: number;
  totalPiutang: number;
  totalRevenue: number;
}

function formatRp(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function formatRpFull(n: number) {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function AchievementDonut({ pct, size = "md" }: { pct: number; size?: "sm" | "md" | "lg" }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const dimClass =
    size === "lg" ? "h-28 w-28 sm:h-32 sm:w-32"
    : size === "sm" ? "h-16 w-16"
    : "h-20 w-20 sm:h-24 sm:w-24";
  const textClass =
    size === "lg" ? "text-xl sm:text-2xl"
    : size === "sm" ? "text-xs"
    : "text-sm sm:text-base";

  return (
    <div className={`relative ${dimClass} shrink-0`} role="img" aria-label={`Achievement ${Math.round(pct)}%`}>
      <svg viewBox="0 0 80 80" className="-rotate-90 h-full w-full">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgb(245 158 11 / 0.18)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="url(#stats-donut-gradient)"
          strokeWidth="7"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
        <defs>
          <linearGradient id="stats-donut-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${textClass} font-bold tabular-nums text-amber-800`}>
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

export function GroupsStatsCards({
  totalGroups,
  totalSales,
  totalTarget,
  avgAchievement,
  totalConfirmed,
  totalPiutang,
  totalRevenue,
}: Props) {
  const realisasiPct = totalTarget > 0 ? Math.round((totalSales / totalTarget) * 100) : 0;
  const sisa = Math.max(0, totalTarget - totalSales);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* ── Card 1: Summary + Piutang ── */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 ring-1 ring-amber-200/40 shadow-md shadow-amber-100/20 p-4 sm:p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Summary
        </p>
        <div className="space-y-2.5">
          <StatRow icon={UsersGroupRounded} label="Total Groups" value={totalGroups.toString()} />
          <div className="border-t border-stone-200/70" />
          <StatRow icon={CalendarMark} label="Booking Confirmed" value={totalConfirmed.toString()} />
        </div>

        {/* ── Piutang section ── */}
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
                {formatRp(totalPiutang)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                {formatRpFull(totalPiutang)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Card 2: Kas Diterima ── */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 ring-1 ring-amber-200/40 shadow-md shadow-amber-100/20 p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <AchievementDonut pct={realisasiPct} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1.5">
              <TargetIcon weight="BoldDuotone" className="h-3 w-3" /> Kas Diterima
            </p>
            <p className="font-heading text-lg sm:text-xl font-bold text-foreground leading-tight tabular-nums mt-0.5 truncate">
              {formatRpFull(totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              TOP paid &amp; di-acknowledge Finance · vs target {avgAchievement}%
            </p>

            <div className="mt-3 pt-3 border-t border-stone-200/70 space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wallet weight="BoldDuotone" className="h-3 w-3" />
                  <span>Nilai Kontrak</span>
                </span>
                <span className="text-sm font-semibold text-amber-800 tabular-nums truncate">
                  {formatRp(totalSales)}
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

function StatRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UsersGroupRounded;
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
