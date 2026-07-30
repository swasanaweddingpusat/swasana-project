import { Wallet, Bill, CardReceive, DangerTriangle } from "@solar-icons/react";
import { fmtRp } from "./ar-format";
import type { ARBooking } from "@/types/finance";

interface ARTerminSummaryData {
  totalOutstanding: number;
  totalKontrak: number;
  sudahTerbayar: number;
  overdue: number;
}

interface CardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}

function Card({ icon: Icon, label, value, sub, danger = false }: CardProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
          <Icon weight="BoldDuotone" className={`size-4 ${danger ? "text-destructive" : "text-muted-foreground"}`} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={`mt-3 font-heading text-base font-bold tabular-nums tracking-tight sm:text-xl ${danger ? "text-destructive" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ARTerminSummary({ bookings }: { bookings: ARBooking[] }): React.ReactElement {
  const summary: ARTerminSummaryData = bookings.reduce(
    (acc, b) => {
      acc.totalOutstanding += b.outstanding;
      acc.totalKontrak += b.totalPrice;
      acc.sudahTerbayar += b.totalPrice - b.outstanding;
      if (b.statusTermin === "overdue") acc.overdue += 1;
      return acc;
    },
    { totalOutstanding: 0, totalKontrak: 0, sudahTerbayar: 0, overdue: 0 }
  );

  const hasOutstanding = summary.totalOutstanding > 0;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card
        icon={Wallet}
        label="Total Outstanding"
        value={fmtRp(summary.totalOutstanding)}
        sub="Piutang yang belum dibayar"
        danger={hasOutstanding}
      />
      <Card
        icon={Bill}
        label="Total Kontrak"
        value={fmtRp(summary.totalKontrak)}
        sub="Nilai kontrak keseluruhan"
      />
      <Card
        icon={CardReceive}
        label="Sudah Terbayar"
        value={fmtRp(summary.sudahTerbayar)}
        sub="Cash-in yang diterima"
      />
      <Card
        icon={DangerTriangle}
        label="Aging"
        value={summary.overdue.toString()}
        sub="Booking dengan termin overdue"
        danger={summary.overdue > 0}
      />
    </div>
  );
}
