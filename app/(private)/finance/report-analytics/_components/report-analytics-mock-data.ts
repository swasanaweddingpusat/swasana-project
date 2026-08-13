// Dummy/mock data untuk preview layout Report & Analytics.
// SEMUA data di file ini hardcoded — bukan hasil query DB. Wiring data asli
// dikerjakan terpisah nanti.

// ─── Executive Overview — stat cards ──────────────────────────────────────────

export interface OverviewStat {
  key: string;
  label: string;
  value: string;
  trend: {
    direction: "up" | "down";
    value: string;
  };
}

export const OVERVIEW_STATS: OverviewStat[] = [
  { key: "omset", label: "Total Omset (Net)", value: "Rp 4,82M", trend: { direction: "up", value: "12.4%" } },
  { key: "dealing", label: "Total Dealing", value: "38", trend: { direction: "up", value: "8.1%" } },
  { key: "activeClient", label: "Active Client", value: "126", trend: { direction: "up", value: "5.6%" } },
  { key: "cancelClient", label: "Cancel Client", value: "9", trend: { direction: "down", value: "2.1%" } },
  { key: "cancelRate", label: "Cancel Rate", value: "6.7%", trend: { direction: "down", value: "1.3%" } },
  { key: "lostRevenue", label: "Lost Revenue", value: "Rp 312Jt", trend: { direction: "down", value: "4.8%" } },
  { key: "avgPackage", label: "Avg Package Value", value: "Rp 126Jt", trend: { direction: "up", value: "3.2%" } },
  { key: "conversionRate", label: "Conversion Rate", value: "31.5%", trend: { direction: "up", value: "2.9%" } },
  { key: "discount", label: "Discount (Total)", value: "Rp 184Jt", trend: { direction: "down", value: "1.6%" } },
  { key: "bonus", label: "Bonus Client", value: "Rp 42Jt", trend: { direction: "up", value: "0.8%" } },
];

export const OVERVIEW_INSIGHT =
  "Omset net naik 12.4% dibanding minggu lalu, didorong lonjakan dealing paket Wedding. Cancel rate turun ke 6.7% — tren membaik.";

// ─── Revenue trend (net) — 12 bulan ───────────────────────────────────────────

export interface RevenueTrendPoint {
  bulan: string;
  omset: number;
}

export const REVENUE_TREND_2026: RevenueTrendPoint[] = [
  { bulan: "Jan", omset: 320_000_000 },
  { bulan: "Feb", omset: 285_000_000 },
  { bulan: "Mar", omset: 410_000_000 },
  { bulan: "Apr", omset: 375_000_000 },
  { bulan: "Mei", omset: 460_000_000 },
  { bulan: "Jun", omset: 512_000_000 },
  { bulan: "Jul", omset: 398_000_000 },
  { bulan: "Agu", omset: 482_000_000 },
  { bulan: "Sep", omset: 445_000_000 },
  { bulan: "Okt", omset: 530_000_000 },
  { bulan: "Nov", omset: 495_000_000 },
  { bulan: "Des", omset: 610_000_000 },
];

// ─── Revenue breakdown — 3 kategori ───────────────────────────────────────────

export interface RevenueBreakdownItem {
  key: "wedding" | "venueOnly" | "mice";
  label: string;
  value: number;
  fill: string;
}

export const REVENUE_BREAKDOWN: RevenueBreakdownItem[] = [
  { key: "wedding", label: "Paket Wedding", value: 2_680_000_000, fill: "var(--brand-ink)" },
  { key: "venueOnly", label: "Venue Only", value: 1_240_000_000, fill: "var(--brand-gold)" },
  { key: "mice", label: "MICE Event", value: 900_000_000, fill: "oklch(0.62 0 0)" },
];

// ─── Top Sales (Omset) ─────────────────────────────────────────────────────────

export interface TopSalesItem {
  rank: number;
  name: string;
  omset: number;
}

export const TOP_SALES: TopSalesItem[] = [
  { rank: 1, name: "Anisa Putri Rahmawati", omset: 682_000_000 },
  { rank: 2, name: "Bagas Wirawan", omset: 594_000_000 },
  { rank: 3, name: "Citra Dewi Lestari", omset: 512_000_000 },
  { rank: 4, name: "Dimas Prasetyo", omset: 438_000_000 },
  { rank: 5, name: "Erlangga Saputra", omset: 401_000_000 },
];

// ─── Team Performance (Omset) ─────────────────────────────────────────────────

export interface TeamPerformanceItem {
  name: string;
  omset: number;
  pct: number; // progress bar fill, 0-100 relative to top team
}

export const TEAM_PERFORMANCE: TeamPerformanceItem[] = [
  { name: "Tim Nusantara", omset: 1_240_000_000, pct: 100 },
  { name: "Tim Cendana", omset: 980_000_000, pct: 79 },
  { name: "Tim Melati", omset: 845_000_000, pct: 68 },
  { name: "Tim Kenanga", omset: 612_000_000, pct: 49 },
  { name: "Tim Anggrek", omset: 505_000_000, pct: 41 },
];

// ─── Top Venue (Omset) ─────────────────────────────────────────────────────────

export interface TopVenueItem {
  name: string;
  omset: number;
}

export const TOP_VENUE: TopVenueItem[] = [
  { name: "Grand Ballroom Kediaman", omset: 1_580_000_000 },
  { name: "Swasana Garden Hall", omset: 1_120_000_000 },
  { name: "The Pavilion Kediaman", omset: 860_000_000 },
  { name: "Rooftop Swasana", omset: 640_000_000 },
  { name: "Kediaman Heritage Room", omset: 420_000_000 },
];

// ─── Cancel Analytics ───────────────────────────────────────────────────────────

export const CANCEL_STATS = {
  totalCancelClient: 9,
  lostRevenue: 312_000_000,
  cancelRate: 6.7,
};

export interface CancelReasonItem {
  key: string;
  label: string;
  value: number;
  fill: string;
}

export const CANCEL_REASONS: CancelReasonItem[] = [
  { key: "budget", label: "Budget", value: 4, fill: "var(--brand-ink)" },
  { key: "vendor", label: "Ganti Vendor", value: 3, fill: "var(--brand-gold)" },
  { key: "schedule", label: "Ubah Jadwal", value: 1, fill: "oklch(0.62 0 0)" },
  { key: "other", label: "Lainnya", value: 1, fill: "var(--destructive)" },
];

// ─── Pipeline by Event Year ─────────────────────────────────────────────────────

export interface PipelineYearItem {
  year: string;
  dealing: number;
  omsetNet: number;
  pctContribution: number;
  fill: string;
}

export const PIPELINE_BY_YEAR: PipelineYearItem[] = [
  { year: "2026", dealing: 24, omsetNet: 3_120_000_000, pctContribution: 64, fill: "var(--brand-ink)" },
  { year: "2027", dealing: 10, omsetNet: 1_340_000_000, pctContribution: 28, fill: "var(--brand-gold)" },
  { year: "2028", dealing: 4, omsetNet: 380_000_000, pctContribution: 8, fill: "oklch(0.62 0 0)" },
];

// ─── MICE Event Performance ──────────────────────────────────────────────────────

export const MICE_STATS = {
  totalDealing: 14,
  omsetNet: 900_000_000,
};

export interface TopSalesMiceItem {
  rank: number;
  name: string;
  omset: number;
  dealing: number;
}

export const TOP_SALES_MICE: TopSalesMiceItem[] = [
  { rank: 1, name: "Farah Aulia Nugraha", omset: 285_000_000, dealing: 5 },
  { rank: 2, name: "Galih Ramadhan", omset: 218_000_000, dealing: 4 },
  { rank: 3, name: "Hana Kusuma Wardani", omset: 172_000_000, dealing: 3 },
];

// ─── Target & Forecast ──────────────────────────────────────────────────────────

export const TARGET_THIS_MONTH = {
  target: 550_000_000,
  current: 482_000_000,
  pct: 88,
  remaining: 68_000_000,
};

export interface ForecastPoint {
  bulan: string;
  actual: number | null;
  forecast: number | null;
}

export const FORECAST_REVENUE: ForecastPoint[] = [
  { bulan: "Agu", actual: 482_000_000, forecast: null },
  { bulan: "Sep", actual: null, forecast: 505_000_000 },
  { bulan: "Okt", actual: null, forecast: 540_000_000 },
  { bulan: "Nov", actual: null, forecast: 520_000_000 },
];

export const TARGET_FORECAST_INSIGHTS = [
  "Omset bulan ini sudah mencapai **88%** dari target — sisa **Rp 68Jt** lagi untuk tercapai penuh.",
  "Forecast 3 bulan ke depan menunjukkan tren stabil dengan rata-rata **Rp 522Jt/bulan**.",
  "Bulan Oktober diproyeksikan jadi puncak omset kuartal ini berkat musim peak season wedding.",
];
