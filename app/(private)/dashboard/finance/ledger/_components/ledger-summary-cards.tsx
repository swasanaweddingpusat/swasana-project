import { Wallet, ClockCircle, TagPrice, CardReceive } from "@solar-icons/react";
import { fmtRp } from "./ledger-format";

/**
 * KPI cashbook — dihitung client-side dari LedgerRow[] (cash-in murni).
 * Semua nilai EXCLUDE row void.
 */
export interface LedgerSummaryData {
  /** Σ cashAmount transaksi ter-ack (uang riil sudah masuk rekening). */
  totalCashIn: number;
  /** Σ amount transaksi pending (menunggu verifikasi Finance). */
  pendingAmount: number;
  /** Σ discountAmount transaksi ter-ack (potongan promo / contra-revenue). */
  discountTotal: number;
  /** Jumlah transaksi non-void. */
  txCount: number;
}

interface CardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
}

function Card({ icon: Icon, label, value, sub }: CardProps): React.ReactElement {
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

export function LedgerSummaryCards({ summary }: { summary: LedgerSummaryData }): React.ReactElement {
  const { totalCashIn, pendingAmount, discountTotal, txCount } = summary;

  // Bar verifikasi: proporsi uang yang sudah ter-ack vs yang masih menunggu.
  const barTotal = totalCashIn + pendingAmount || 1;
  const ackedPct = (totalCashIn / barTotal) * 100;
  const pendingPct = (pendingAmount / barTotal) * 100;
  const hasData = totalCashIn + pendingAmount > 0;

  return (
    <div className="space-y-3">
      {/* Status verifikasi bar */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="font-heading text-sm font-bold text-foreground">Status Verifikasi Kas</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Terverifikasi vs menunggu ack Finance</p>

        <div className="mt-3 overflow-hidden rounded-full bg-muted" style={{ height: "14px" }}>
          {hasData ? (
            <div className="flex h-full w-full">
              {totalCashIn > 0 && <div className="bg-primary" style={{ width: `${ackedPct}%` }} />}
              {pendingAmount > 0 && (
                <div className="bg-primary/30" style={{ width: `${pendingPct}%` }} />
              )}
            </div>
          ) : (
            <div className="h-full w-full bg-muted" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">Terverifikasi</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{fmtRp(totalCashIn)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary/30" />
            <span className="text-xs text-muted-foreground">Menunggu</span>
            <span className="text-xs font-medium text-foreground tabular-nums">{fmtRp(pendingAmount)}</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          icon={Wallet}
          label="Total Kas Masuk"
          value={fmtRp(totalCashIn)}
          sub="Sudah diverifikasi Finance"
        />
        <Card
          icon={ClockCircle}
          label="Menunggu Verifikasi"
          value={fmtRp(pendingAmount)}
          sub="Belum di-ack Finance"
        />
        <Card
          icon={TagPrice}
          label="Potongan Promo"
          value={fmtRp(discountTotal)}
          sub="Contra-revenue (ter-ack)"
        />
        <Card
          icon={CardReceive}
          label="Total Transaksi"
          value={txCount.toLocaleString("id-ID")}
          sub="Semua cash-in aktif"
        />
      </div>
    </div>
  );
}
