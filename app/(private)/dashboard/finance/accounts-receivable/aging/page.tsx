import { ClockCircle } from "@solar-icons/react";

export default function AccountsReceivableAgingPage() {
  return (
    <div className="flex flex-col gap-4 py-6 px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-foreground">Accounts Receivable — Aging</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <ClockCircle weight="BoldDuotone" className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Aging Report</p>
          <p className="text-sm text-muted-foreground">
            Halaman ini sedang disiapkan.
          </p>
        </div>
      </div>
    </div>
  );
}
