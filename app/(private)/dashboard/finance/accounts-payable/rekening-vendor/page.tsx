import { Buildings2 } from "@solar-icons/react";

export default function RekeningVendorPage() {
  return (
    <div className="flex flex-col gap-4 py-6 px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold text-foreground">Accounts Payable — Rekening Vendor</h1>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
        <Buildings2 weight="BoldDuotone" className="h-10 w-10 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Rekening Vendor</p>
          <p className="text-sm text-muted-foreground">Halaman ini sedang disiapkan.</p>
        </div>
      </div>
    </div>
  );
}
