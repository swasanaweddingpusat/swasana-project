// FILE: lib/utils/kpiFormatters.ts

export function formatRupiah(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatPct(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";
  return `${num.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export function formatKpiStatus(status: string): { label: string; variant: BadgeVariant } {
  switch (status) {
    case "DRAFT":
      return { label: "Draft", variant: "secondary" };
    case "SIMULATED":
      return { label: "Simulasi", variant: "outline" };
    case "PENDING_REVIEW":
      return { label: "Menunggu", variant: "destructive" };
    case "FINALIZED":
      return { label: "Final", variant: "default" };
    default:
      return { label: status, variant: "secondary" };
  }
}

export function formatMissingReason(reason: string): string {
  const map: Record<string, string> = {
    base_commission_missing: "Komisi dasar belum dikonfigurasi",
    scheme_is_draft: "Skema masih draft",
    manager_lt70_conflict_unresolved: "Konflik aturan Manager <70% belum diselesaikan",
    target_missing: "Target belum diisi",
    achievement_missing: "Data realisasi belum diisi",
    venue_missing: "Venue belum ditentukan",
    tier_config_missing: "Konfigurasi tier tidak ditemukan",
    deduction_basis_missing: "Basis potongan belum dikonfigurasi",
    assignment_missing: "Penugasan KPI belum ada",
    period_not_confirmed: "Periode belum dikonfirmasi",
  };
  return map[reason] ?? reason;
}
