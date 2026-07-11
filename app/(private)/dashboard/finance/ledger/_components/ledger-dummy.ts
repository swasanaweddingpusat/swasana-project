import type {
  LedgerActivity,
  LedgerEntry,
  LedgerPromoOption,
  LedgerTerminOption,
} from "@/types/finance";

/**
 * Dummy ledger data — UI-first scaffolding. No DB yet.
 * Lives in React state (not a frozen const) so the entry drawer can append rows.
 * Replace with a real query/hook once the schema lands.
 *
 * Struktur meniru sheet "DATA" di buku besar AR SAMISARA:
 * tiap baris = satu transaksi, dengan penanda tangan (ack) sendiri.
 */

function entry(
  e: Partial<LedgerEntry> & Pick<LedgerEntry, "id" | "occurredAt" | "bookingId" | "clientName" | "entryType" | "status" | "amount">,
): LedgerEntry {
  return {
    ackStatus: "pending",
    acknowledgedBy: null,
    paymentMethod: null,
    invoiceNumber: null,
    discountProgramName: null,
    linkedTerminIds: [],
    linkedTerminLabels: [],
    paymentEvidenceName: null,
    notes: null,
    ...e,
  };
}

export const SEED_LEDGER: LedgerEntry[] = [
  // ── Booking A — Ridho & Tiara (50jt, 3 termin, DP lunas) ──
  entry({
    id: "led-1",
    occurredAt: "2026-01-02",
    bookingId: "bkg-a",
    clientName: "Ridho & Tiara",
    entryType: "cash_in",
    status: "unearned",
    amount: 30_000_000,
    ackStatus: "acknowledged",
    acknowledgedBy: "Rosita",
    paymentMethod: "BCA 149",
    invoiceNumber: "905/SMSR-GWN/I/25",
    notes: "DP 60%",
  }),
  entry({
    id: "led-2",
    occurredAt: "2026-03-14",
    bookingId: "bkg-a",
    clientName: "Ridho & Tiara",
    entryType: "receivable",
    status: "receivable",
    amount: 20_000_000,
    notes: "Pelunasan — jatuh tempo H-30",
  }),

  // ── Booking B — Aura & Adi (75jt, bayar penuh, ada promo) ──
  entry({
    id: "led-3",
    occurredAt: "2026-01-12",
    bookingId: "bkg-b",
    clientName: "Aura & Adi",
    entryType: "cash_in",
    status: "unearned",
    amount: 49_500_000,
    ackStatus: "acknowledged",
    acknowledgedBy: "Rosita",
    paymentMethod: "BCA 149",
    invoiceNumber: "929/SMSR-GWN/I/25",
    notes: "Pelunasan setelah potongan promo",
  }),
  entry({
    id: "led-4",
    occurredAt: "2026-01-12",
    bookingId: "bkg-b",
    clientName: "Aura & Adi",
    entryType: "discount",
    status: "unearned",
    amount: 5_500_000,
    discountProgramName: "Early Bird 10%",
    notes: "Potongan 10% dari nominal dibayar",
  }),
  entry({
    id: "led-5",
    occurredAt: "2026-01-05",
    bookingId: "bkg-b",
    clientName: "Aura & Adi",
    entryType: "cash_in",
    status: "unearned",
    amount: 20_000_000,
    ackStatus: "acknowledged",
    acknowledgedBy: "Rosita",
    paymentMethod: "Mandiri 771",
    invoiceNumber: "918/SMSR-GWN/I/25",
    notes: "DP",
  }),

  // ── Booking C — Sinta & Dimas (40jt, acara SELESAI → earned) ──
  entry({
    id: "led-6",
    occurredAt: "2025-11-20",
    bookingId: "bkg-c",
    clientName: "Sinta & Dimas",
    entryType: "cash_in",
    status: "earned",
    amount: 40_000_000,
    ackStatus: "acknowledged",
    acknowledgedBy: "Rosita",
    paymentMethod: "BCA 149",
    invoiceNumber: "812/SMSR-GWN/XI/24",
    notes: "Lunas — acara sudah berlangsung",
  }),
  entry({
    id: "led-7",
    occurredAt: "2026-06-15",
    bookingId: "bkg-c",
    clientName: "Sinta & Dimas",
    entryType: "recognition",
    status: "earned",
    amount: 40_000_000,
    notes: "Acara selesai + 4 approval → pendapatan diakui",
  }),

  // ── Booking D — Nadia & Farel (baru signing, belum bayar) ──
  entry({
    id: "led-8",
    occurredAt: "2026-07-01",
    bookingId: "bkg-d",
    clientName: "Nadia & Farel",
    entryType: "receivable",
    status: "receivable",
    amount: 25_000_000,
    notes: "DP — jatuh tempo H-7",
  }),
  entry({
    id: "led-9",
    occurredAt: "2026-07-01",
    bookingId: "bkg-d",
    clientName: "Nadia & Farel",
    entryType: "receivable",
    status: "receivable",
    amount: 35_000_000,
    notes: "Pelunasan",
  }),

  // ── Booking E — Gathering Corp XYZ (MICE, cash masuk belum di-ack) ──
  entry({
    id: "led-10",
    occurredAt: "2026-07-08",
    bookingId: "bkg-e",
    clientName: "Corp XYZ (MICE)",
    entryType: "cash_in",
    status: "unearned",
    amount: 15_000_000,
    ackStatus: "pending",
    paymentMethod: "BNI 088",
    invoiceNumber: "1042/SMSR-GWN/VII/25",
    notes: "DP gathering — menunggu konfirmasi Finance",
  }),
];

/** Mock discount catalog for the entry drawer promo picker. */
export const DUMMY_PROMOS: LedgerPromoOption[] = [
  { id: "promo-1", name: "Early Bird 10%", discountType: "PERCENTAGE", discountValue: 10 },
  { id: "promo-2", name: "Cashback Weekday", discountType: "NOMINAL", discountValue: 2_500_000 },
  { id: "promo-3", name: "Referral 5%", discountType: "PERCENTAGE", discountValue: 5 },
];

/**
 * Booking option buat client picker di entry drawer.
 * `status` meniru bookingStatus asli — cuma yang sudah Confirmed/approved (bukan
 * Pending) yang boleh dicatat transaksinya. FE-only dummy.
 */
export interface LedgerBookingOption {
  id: string;
  clientName: string;
  status: "Confirmed" | "Pending" | "Rejected" | "Lost";
}

/** Mock booking list for the entry drawer client picker. */
export const DUMMY_BOOKINGS: LedgerBookingOption[] = [
  { id: "bkg-a", clientName: "Ridho & Tiara", status: "Confirmed" },
  { id: "bkg-b", clientName: "Aura & Adi", status: "Confirmed" },
  { id: "bkg-c", clientName: "Sinta & Dimas", status: "Confirmed" },
  { id: "bkg-d", clientName: "Nadia & Farel", status: "Confirmed" },
  { id: "bkg-e", clientName: "Corp XYZ (MICE)", status: "Confirmed" },
  // Booking yang belum boleh dicatat transaksinya (masih pending approval) —
  // sengaja ada di sini biar filter dropdown kelihatan kerja.
  { id: "bkg-f", clientName: "Rani & Bagas (belum approve)", status: "Pending" },
  { id: "bkg-g", clientName: "Expo Nusantara (draft)", status: "Pending" },
];

/**
 * Booking yang boleh dicatat transaksinya di ledger — hanya yang sudah
 * Confirmed/approved (bukan Pending/Rejected/Lost).
 */
export function bookableBookings(): LedgerBookingOption[] {
  return DUMMY_BOOKINGS.filter((b) => b.status === "Confirmed");
}

/* ─── Auto-nomor kwitansi ────────────────────────────────────────────────────
 * FE-only generator — samain sama penomoran auto di booking. Format:
 *   <no>/KW/<code_brand>/<code_venue>/<bulan-romawi>/<tahun>
 * Contoh: 0006/KW/GWN/SMSR/VII/2026
 * Kode brand/venue di-hardcode dummy (org = Gunawarman / Samisara) — nanti
 * diambil dari booking terkait pas udah ada backend.
 */
const KWITANSI_BRAND_CODE = "GWN";
const KWITANSI_VENUE_CODE = "SMSR";
const ROMAN_MONTHS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Nomor kwitansi berikutnya — dihitung dari entry yang sudah punya nomor. */
export function nextKwitansiSeq(entries: LedgerEntry[]): number {
  return entries.filter((e) => e.invoiceNumber).length + 1;
}

/**
 * Rakit nomor kwitansi dari sequence + tanggal transaksi.
 * `seq` di-pad 4 digit, bulan Roman, tahun 4 digit.
 */
export function generateKwitansiNumber(seq: number, isoDate: string): string {
  const parsed = new Date(isoDate);
  const valid = !Number.isNaN(parsed.getTime());
  const monthIdx = valid ? parsed.getMonth() + 1 : 1;
  const year = valid ? parsed.getFullYear() : new Date().getFullYear();
  const no = String(seq).padStart(4, "0");
  return `${no}/KW/${KWITANSI_BRAND_CODE}/${KWITANSI_VENUE_CODE}/${ROMAN_MONTHS[monthIdx]}/${year}`;
}

/** Rekening options (mirror kolom "VIA" di sheet DATA). */
export const DUMMY_REKENING = ["BCA 149", "Mandiri 771", "BNI 088", "Cash"];

/**
 * Termin/TOP catalog per booking — buat multi-select linking di entry drawer.
 * Tiap booking punya beberapa termin; pembayaran bisa nutup satu / beberapa termin.
 */
export const DUMMY_TERMINS: LedgerTerminOption[] = [
  { id: "top-a1", bookingId: "bkg-a", name: "DP 60%", amount: 30_000_000, dueDate: "2026-01-02" },
  { id: "top-a2", bookingId: "bkg-a", name: "Pelunasan 40%", amount: 20_000_000, dueDate: "2026-03-14" },
  { id: "top-b1", bookingId: "bkg-b", name: "DP", amount: 25_000_000, dueDate: "2026-01-05" },
  { id: "top-b2", bookingId: "bkg-b", name: "Pelunasan", amount: 50_000_000, dueDate: "2026-01-12" },
  { id: "top-c1", bookingId: "bkg-c", name: "Lunas Sekaligus", amount: 40_000_000, dueDate: "2025-11-20" },
  { id: "top-d1", bookingId: "bkg-d", name: "DP", amount: 25_000_000, dueDate: "2026-07-08" },
  { id: "top-d2", bookingId: "bkg-d", name: "Pelunasan", amount: 35_000_000, dueDate: "2026-08-01" },
  { id: "top-e1", bookingId: "bkg-e", name: "DP Gathering", amount: 15_000_000, dueDate: "2026-07-08" },
  { id: "top-e2", bookingId: "bkg-e", name: "Pelunasan Gathering", amount: 35_000_000, dueDate: "2026-07-25" },
];

/** Termin options untuk satu booking (helper buat drawer). */
export function terminsForBooking(bookingId: string): LedgerTerminOption[] {
  return DUMMY_TERMINS.filter((t) => t.bookingId === bookingId);
}

/**
 * Dummy activity log — riwayat per transaksi (append-only). Meniru "table baru"
 * ledger_activity yang belum ada migration-nya (FE-only, hidup di React state).
 * Baris yang sudah acknowledged punya jejak created → acknowledged.
 */
export const SEED_ACTIVITY: LedgerActivity[] = [
  // led-1 — DP Ridho & Tiara (sudah di-ack)
  { id: "act-1a", entryId: "led-1", action: "created", actorName: "Bintang", actorRole: "Sales", signatureDataUrl: null, note: "DP 60% via transfer BCA", createdAt: "2026-01-02T09:14:00" },
  { id: "act-1b", entryId: "led-1", action: "acknowledged", actorName: "Rosita", actorRole: "Finance", signatureDataUrl: null, note: "Mutasi cocok — dana masuk BCA 149", createdAt: "2026-01-02T15:40:00" },
  // led-3 — Pelunasan Aura & Adi (sudah di-ack)
  { id: "act-3a", entryId: "led-3", action: "created", actorName: "Bintang", actorRole: "Sales", signatureDataUrl: null, note: "Pelunasan setelah promo", createdAt: "2026-01-12T10:02:00" },
  { id: "act-3b", entryId: "led-3", action: "acknowledged", actorName: "Rosita", actorRole: "Finance", signatureDataUrl: null, note: null, createdAt: "2026-01-12T11:20:00" },
  // led-10 — DP gathering (masih pending, baru created)
  { id: "act-10a", entryId: "led-10", action: "created", actorName: "Dewi", actorRole: "Sales", signatureDataUrl: null, note: "DP gathering corp — menunggu verifikasi Finance", createdAt: "2026-07-08T13:05:00" },
];

/** Activity untuk satu transaksi, terbaru di atas. */
export function activitiesForEntry(entryId: string, all: LedgerActivity[]): LedgerActivity[] {
  return all
    .filter((a) => a.entryId === entryId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
