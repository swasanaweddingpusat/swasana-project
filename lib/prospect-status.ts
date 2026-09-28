/** Nama status prospek yang punya arti khusus di laporan funnel dan kartu
 *  overview. Status lain bebas ditambah lewat Settings tanpa menyentuh kode —
 *  yang di sini hanya dipakai saat sebuah angka laporan harus merujuk status
 *  tertentu (mis. "Deal" untuk rasio closing).
 *
 *  Kalau admin mengganti nama status ini lewat Settings, angka laporan yang
 *  bersangkutan ikut kosong — itu disengaja, agar tidak diam-diam salah hitung. */
export const PROSPECT_STATUS = {
  COLD: "Cold Prospek",
  WARM: "Warm",
  HOT: "Hot",
  NO_RESPONSE: "No Response",
  ONLINE_MEETING: "Online Meeting",
  BELUM_VISIT: "Belum Visit",
  VISIT_VENUE: "Visit Venue",
  TIDAK_JADI_VISIT_LOST: "Tidak Jadi Visit (Lost)",
  DEAL: "Deal",
  NO_DEAL_LOST: "No Deal (Lost)",
  SURVEY: "Survey",
} as const;

export type ProspectStatusName = (typeof PROSPECT_STATUS)[keyof typeof PROSPECT_STATUS];

/** Warna badge per status. Status buatan admin yang tidak ada di sini memakai
 *  `PROSPECT_STATUS_FALLBACK_CLASS`, jadi menambah status tidak pernah bikin
 *  badge-nya rusak. */
export const PROSPECT_STATUS_CLASS: Record<string, string> = {
  [PROSPECT_STATUS.COLD]: "bg-sky-100 text-sky-700 border-0",
  [PROSPECT_STATUS.WARM]: "bg-amber-100 text-amber-700 border-0",
  [PROSPECT_STATUS.HOT]: "bg-orange-100 text-orange-700 border-0",
  [PROSPECT_STATUS.NO_RESPONSE]: "bg-slate-100 text-slate-700 border-0",
  [PROSPECT_STATUS.ONLINE_MEETING]: "bg-violet-100 text-violet-700 border-0",
  [PROSPECT_STATUS.BELUM_VISIT]: "bg-yellow-100 text-yellow-700 border-0",
  [PROSPECT_STATUS.VISIT_VENUE]: "bg-emerald-100 text-emerald-700 border-0",
  [PROSPECT_STATUS.TIDAK_JADI_VISIT_LOST]: "bg-red-100 text-red-700 border-0",
  [PROSPECT_STATUS.DEAL]: "bg-green-100 text-green-700 border-0",
  [PROSPECT_STATUS.NO_DEAL_LOST]: "bg-rose-100 text-rose-700 border-0",
  [PROSPECT_STATUS.SURVEY]: "bg-teal-100 text-teal-700 border-0",
};

export const PROSPECT_STATUS_FALLBACK_CLASS = "bg-muted text-muted-foreground border-0";

export function prospectStatusClass(name: string | null | undefined): string {
  if (!name) return PROSPECT_STATUS_FALLBACK_CLASS;
  return PROSPECT_STATUS_CLASS[name] ?? PROSPECT_STATUS_FALLBACK_CLASS;
}
