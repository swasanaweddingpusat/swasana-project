import { Bill, Wallet, CheckCircle, TagPrice } from "@solar-icons/react";
import type { LedgerSummary } from "@/types/finance";
import { fmtRp } from "./ledger-format";

interface CardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
}

function Card({ icon: Icon, label, value, sub }: CardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
          <Icon weight="BoldDuotone" className="size-4 text-muted-foreground" />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 font-heading text-xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function LedgerSummaryCards({ summary }: { summary: LedgerSummary }) {
  const { piutang, unearned, earned, potongan } = summary;
  const barTotal = piutang + unearned + earned || 1;

  const piutangPct = (piutang / barTotal) * 100;
  const unearnedPct = (unearned / barTotal) * 100;
  const earnedPct = (earned / barTotal) * 100;
  const hasData = piutang + unearned + earned > 0;

  return (
    <div className="space-y-3">
      {/* Money-flow bar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="font-heading text-sm font-bold text-foreground">Perjalanan Uang</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Piutang → Unearned → Earned</p>

        <div className="mt-3 overflow-hidden rounded-full bg-muted" style={{ height: "14px" }}>
          {hasData ? (
            <div className="flex h-full w-full">
              {piutang > 0 && (
                <div className="bg-secondary" style={{ width: `${piutangPct}%` }} />
              )}
              {unearned > 0 && (
                <div className="bg-primary/40" style={{ width: `${unearnedPct}%` }} />
              )}
              {earned > 0 && (
                <div className="bg-primary" style={{ width: `${earnedPct}%` }} />
              )}
            </div>
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-secondary border border-border" />
            <span className="text-xs text-muted-foreground">Piutang</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{fmtRp(piutang)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary/40" />
            <span className="text-xs text-muted-foreground">Unearned</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{fmtRp(unearned)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: "var(--brand-gold)" }} />
            <span className="text-xs text-muted-foreground">Earned</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{fmtRp(earned)}</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card icon={Bill} label="Piutang" value={fmtRp(piutang)} sub="Belum dibayar client" />
        <Card icon={Wallet} label="Unearned" value={fmtRp(unearned)} sub="Masuk, belum jadi pendapatan" />
        <Card icon={CheckCircle} label="Earned" value={fmtRp(earned)} sub="Pendapatan sah" />
        <Card icon={TagPrice} label="Potongan" value={fmtRp(potongan)} sub="Total diskon promo" />
      </div>
    </div>
  );
}
