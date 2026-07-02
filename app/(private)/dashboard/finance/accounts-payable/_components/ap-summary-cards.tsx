import { Wallet, HandMoney, ClipboardCheck, ClockCircle } from "@solar-icons/react";
import { fmtRp } from "./ap-format";

interface ApSummary {
  totalOutstanding: number;
  totalPaid: number;
  pendingAckCount: number;
  onHoldCount: number;
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
}) {
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

export function ApSummaryCards({ summary }: { summary: ApSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        icon={Wallet}
        label="Total Outstanding"
        value={fmtRp(summary.totalOutstanding)}
        sub="Belum dibayar"
      />
      <Card
        icon={HandMoney}
        label="Sudah Dibayar"
        value={fmtRp(summary.totalPaid)}
        sub="Akumulasi pembayaran"
      />
      <Card
        icon={ClipboardCheck}
        label="Pending Ack"
        value={summary.pendingAckCount.toString()}
        sub="Menunggu konfirmasi terima"
      />
      <Card
        icon={ClockCircle}
        label="On Hold"
        value={summary.onHoldCount.toString()}
        sub="Menunggu event selesai"
      />
    </div>
  );
}
