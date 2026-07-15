import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

/* ─── Derived term payments (§5, §6.6) ──────────────────────────────────────────
 *
 * Setelah TOP di-slim (Fase 5), TermOfPayment cuma nyimpen JADWAL (name/amount/
 * dueDate). "Berapa yang sudah terbayar" TIDAK disimpan di TOP lagi — dia DERIVED
 * dari cashbook: Σ PaymentAllocation.amount (GROSS) milik Ledger `in` yang
 * ter-ack (`ackStatus=acknowledged`) & non-void (`voidedAt=null`).
 *
 * Alokasi pakai GROSS (§6.4): termin bisa LUNAS walau kas riil lebih kecil karena
 * promo — selisihnya kebukti sebagai contra-revenue di Ledger.discountAmount.
 * Void di-exclude supaya koreksi non-destruktif otomatis "membuka" kembali termin.
 */

/**
 * Bulk: berapa GROSS yang sudah nutup tiap termin, untuk sekumpulan booking —
 * SATU groupBy buat semua booking (bukan N query). Dipakai AR listing (≤500
 * booking) & derived status termin.
 *
 * Return `Map<termId, paidGross>`. Termin tanpa alokasi ter-ack tidak muncul di
 * map (caller anggap paid = 0).
 */
export async function getTermPaidMapForBookings(
  bookingIds: string[],
): Promise<Map<string, number>> {
  if (bookingIds.length === 0) return new Map();

  const rows = await db.paymentAllocation.groupBy({
    by: ["termId"],
    where: {
      ledger: {
        bookingId: { in: bookingIds },
        direction: "in",
        ackStatus: "acknowledged",
        voidedAt: null,
      },
    },
    _sum: { amount: true },
  });

  return new Map(rows.map((r) => [r.termId, r._sum.amount ?? 0]));
}

/**
 * Single booking convenience — `Map<termId, paidGross>` buat satu booking
 * (ar-detail-drawer, booking-finance-detail). Wrapper tipis di atas bulk.
 */
export async function getTermPaidMap(bookingId: string): Promise<Map<string, number>> {
  return getTermPaidMapForBookings([bookingId]);
}

/**
 * Bulk: total alokasi GROSS non-void (pending + acknowledged) per termin, untuk
 * sekumpulan booking — dipakai buat GUARD "termin terkunci" (FIX A), BUKAN buat
 * derivasi status termin (itu tetap acked-only, lihat getTermPaidMapForBookings).
 *
 * Beda dari getTermPaidMapForBookings: filter `ackStatus:"acknowledged"` DIBUANG,
 * cukup `direction:"in", voidedAt:null`. Kenapa: hapus termin → PaymentAllocation
 * cascade-delete tapi Ledger induknya tetap hidup → cash-in "yatim". Alokasi yang
 * masih pending (belum di-ack Finance) TETAP harus ngunci termin-nya, biar gak ada
 * cash-in yang kehilangan induk termin secara diam-diam.
 *
 * Return `Map<termId, allocatedGross>`. Termin tanpa alokasi non-void tidak muncul
 * di map (caller anggap 0 / unlocked).
 */
export async function getTermAllocatedMap(bookingIds: string[]): Promise<Map<string, number>> {
  if (bookingIds.length === 0) return new Map();

  const rows = await db.paymentAllocation.groupBy({
    by: ["termId"],
    where: {
      ledger: {
        bookingId: { in: bookingIds },
        direction: "in",
        voidedAt: null,
      },
    },
    _sum: { amount: true },
  });

  return new Map(rows.map((r) => [r.termId, r._sum.amount ?? 0]));
}

/** Satu cash-in yang beralokasi ke sebuah termin — buat riwayat pembayaran AR. */
export interface TermAllocationDetail {
  /** PaymentAllocation id. */
  id: string;
  amount: number;
  /** ISO — tanggal uang masuk (Ledger.occurredAt). */
  paidAt: string;
  notes: string | null;
}

/**
 * Bulk: riwayat alokasi (acked, non-void) per termin untuk sekumpulan booking.
 * Menggantikan tabel `PartialPayment` (di-drop Fase 5) sebagai sumber riwayat
 * pembayaran per termin di AR. Return `Map<termId, TermAllocationDetail[]>`.
 */
export async function getTermAllocationsForBookings(
  bookingIds: string[],
): Promise<Map<string, TermAllocationDetail[]>> {
  if (bookingIds.length === 0) return new Map();

  const rows = await db.paymentAllocation.findMany({
    where: {
      ledger: {
        bookingId: { in: bookingIds },
        direction: "in",
        ackStatus: "acknowledged",
        voidedAt: null,
      },
    },
    select: {
      id: true,
      amount: true,
      termId: true,
      ledger: { select: { occurredAt: true, notes: true } },
    },
    orderBy: { ledger: { occurredAt: "asc" } },
    take: 2000,
  });

  const map = new Map<string, TermAllocationDetail[]>();
  for (const r of rows) {
    const arr = map.get(r.termId) ?? [];
    arr.push({
      id: r.id,
      amount: Number(r.amount),
      paidAt: r.ledger.occurredAt.toISOString(),
      notes: r.ledger.notes ?? null,
    });
    map.set(r.termId, arr);
  }
  return map;
}

/** Satu cash-in booking (semua status) — buat riwayat pembayaran di editor booking. */
export interface BookingCashIn {
  /** Ledger id. */
  id: string;
  amount: number;
  /** ISO — tanggal uang masuk (Ledger.occurredAt). */
  occurredAt: string;
  ackStatus: "pending" | "acknowledged" | "rejected";
  invoiceNumber: string | null;
  notes: string | null;
  /** Ditandai tampil di Summary Payment PO PDF. */
  showInPo: boolean;
  /** Nama termin yang di-cover cash-in ini (dari PaymentAllocation). */
  linkedTermNames: string[];
  paymentMethodId: string | null;
  discountProgramId: string | null;
  discountAmount: number;
  evidence: string | null;
  /** Alokasi ke termin — termId + jumlah GROSS. */
  allocations: { termId: string; amount: number }[];
}

/**
 * Semua cash-in `in` (non-void) satu booking — TERMASUK yang masih `pending`
 * (belum di-ack Finance). Beda dari getTermAllocationsForBookings yang acked-only:
 * ini buat "Riwayat Pembayaran" di editor booking, biar pembayaran yang baru
 * dicatat langsung kelihatan dengan badge status verifikasinya. TIDAK dipakai
 * buat derivasi status termin (itu tetap acked-only, lihat getTermPaidMap).
 *
 * NOT "use cache" — butuh fresh tiap drawer edit dibuka.
 */
export async function getBookingCashIns(bookingId: string): Promise<BookingCashIn[]> {
  const rows = await db.ledger.findMany({
    where: { bookingId, direction: "in", voidedAt: null },
    orderBy: { occurredAt: "desc" },
    take: 200,
    select: {
      id: true,
      amount: true,
      occurredAt: true,
      ackStatus: true,
      invoiceNumber: true,
      notes: true,
      showInPo: true,
      paymentMethodId: true,
      discountProgramId: true,
      discountAmount: true,
      evidence: true,
      allocations: {
        select: {
          termId: true,
          amount: true,
          term: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    occurredAt: r.occurredAt.toISOString(),
    ackStatus: r.ackStatus,
    invoiceNumber: r.invoiceNumber ?? null,
    notes: r.notes ?? null,
    showInPo: r.showInPo,
    paymentMethodId: r.paymentMethodId ?? null,
    discountProgramId: r.discountProgramId ?? null,
    discountAmount: Number(r.discountAmount),
    evidence: r.evidence ?? null,
    linkedTermNames: r.allocations.map((a) => a.term.name),
    allocations: r.allocations.map((a) => ({
      termId: a.termId,
      amount: Number(a.amount),
    })),
  }));
}

/** Satu cash-in yang alokasinya tidak menutup penuh nominal gross-nya sendiri. */
export interface OrphanCashIn {
  /** Ledger id. */
  id: string;
  bookingId: string;
  clientName: string;
  amount: number;
  allocatedTotal: number;
  /** amount - allocatedTotal (bagian gross yang tidak nempel ke termin manapun). */
  unallocated: number;
  occurredAt: string;
  ackStatus: "pending" | "acknowledged" | "rejected";
}

/**
 * Detektor read-only (FIX A §A.5) — cash-in `in` non-void yang alokasinya lebih kecil
 * dari nominal gross-nya sendiri (Σallocations < amount). Ini gejala orphan: termin
 * yang tadinya dialokasi udah dihapus (sebelum guard ini ada) sehingga sebagian/semua
 * alokasinya cascade-delete, tapi Ledger induknya tetap hidup.
 *
 * MURNI SURFACE buat Finance review — TIDAK auto-fix apapun. Auto-heal adalah
 * keputusan terpisah (lihat design doc, diluar scope FIX A).
 */
export async function findOrphanCashIns(bookingId?: string): Promise<OrphanCashIn[]> {
  const rows = await db.ledger.findMany({
    where: {
      direction: "in",
      voidedAt: null,
      ...(bookingId ? { bookingId } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 500,
    select: {
      id: true,
      bookingId: true,
      amount: true,
      occurredAt: true,
      ackStatus: true,
      booking: { select: { snapCustomer: { select: { name: true } } } },
      allocations: { select: { amount: true } },
    },
  });

  return rows
    .map((r) => {
      const amount = Number(r.amount);
      const allocatedTotal = r.allocations.reduce((s, a) => s + Number(a.amount), 0);
      return {
        id: r.id,
        bookingId: r.bookingId,
        clientName: r.booking.snapCustomer?.name ?? "-",
        amount,
        allocatedTotal,
        unallocated: amount - allocatedTotal,
        occurredAt: r.occurredAt.toISOString(),
        ackStatus: r.ackStatus,
      };
    })
    .filter((r) => r.allocatedTotal < r.amount);
}

export type DerivedTermStatus = "paid" | "partial" | "overdue" | "not_due_yet";

/**
 * Status termin DERIVED dari nominal jadwal + gross terbayar (§5). Menggantikan
 * `TermOfPayment.paymentStatus` yang di-drop Fase 5.
 *  - paidGross ≥ amount        → paid (lunas; gross bisa nutup walau kas < nominal)
 *  - 0 < paidGross < amount     → partial
 *  - belum terbayar & lewat due → overdue
 *  - belum terbayar & belum due → not_due_yet
 */
export function deriveTermStatus(
  amount: number,
  paidGross: number,
  dueDate: Date,
  now: Date,
): DerivedTermStatus {
  if (paidGross >= amount) return "paid";
  if (paidGross > 0) return "partial";
  return dueDate < now ? "overdue" : "not_due_yet";
}

/* ─── Ledger view (halaman Cashbook) ────────────────────────────────────────────
 *
 * Read-model native DB (bukan `types/finance.ts::LedgerEntry` yang masih model
 * LAMA append-only entryType). FE read-model direworked di Fase 4 — sampai itu,
 * query ini pakai bentuknya sendiri (pola `ARBookingsResult` di ar.ts).
 */

export interface LedgerRow {
  id: string;
  /** ISO — tanggal uang bergerak. */
  occurredAt: string;
  bookingId: string;
  /** Denormalized dari snapshot customer booking. */
  clientName: string;
  direction: "in" | "out";
  ackStatus: "pending" | "acknowledged" | "rejected";
  /** GROSS — nominal yang meng-offset termin. */
  amount: number;
  discountAmount: number;
  /** Uang riil masuk = amount - discountAmount. */
  cashAmount: number;
  discountProgramName: string | null;
  /** Bank tujuan "BCA 149" (bankName + 3 digit akhir). Null = Cash. */
  paymentMethod: string | null;
  /** No. kwitansi (bukti terima). */
  invoiceNumber: string | null;
  /** Storage path/key bukti bayar (BUKAN full URL — FE prepend S3 base). */
  evidence: string | null;
  notes: string | null;
  /** True = row dibatalkan (void tombstone). Tetap tampil buat audit. */
  voided: boolean;
  createdByName: string | null;
  acknowledgedByName: string | null;
  /** Termin yang di-cover cash-in ini (dari PaymentAllocation). */
  linkedTermins: { id: string; name: string; amount: number; allocated: number }[];
  /** Jumlah baris riwayat (created/ack/void) — buat badge Riwayat. */
  activityCount: number;
}

function profileName(
  p: { fullName: string | null; nickName: string | null } | null,
): string | null {
  return p?.fullName ?? p?.nickName ?? null;
}

/**
 * Daftar transaksi cashbook (arah `in`) untuk halaman Ledger. Row void TETAP
 * ditampilkan (badge "Dibatalkan") buat audit — yang di-exclude cuma di derivasi
 * status termin (lihat getTermPaidMapForBookings).
 *
 * Hard cap 500 (AGENTS.md: findMany wajib paginated). Filter/tab dikerjakan
 * client-side dulu (konsisten dengan ar.ts) — server filter menyusul kalau perlu.
 */
export async function getLedgerEntries(): Promise<{ data: LedgerRow[]; total: number }> {
  "use cache";
  cacheTag("ledger");
  cacheLife("minutes");

  const rows = await db.ledger.findMany({
    where: { direction: "in" },
    orderBy: { occurredAt: "desc" },
    take: 500,
    select: {
      id: true,
      occurredAt: true,
      bookingId: true,
      direction: true,
      ackStatus: true,
      amount: true,
      discountAmount: true,
      cashAmount: true,
      invoiceNumber: true,
      evidence: true,
      notes: true,
      voidedAt: true,
      booking: { select: { snapCustomer: { select: { name: true } } } },
      discountProgram: { select: { name: true } },
      paymentMethod: { select: { bankName: true, bankAccountNumber: true } },
      createdBy: { select: { fullName: true, nickName: true } },
      acknowledgedBy: { select: { fullName: true, nickName: true } },
      allocations: {
        select: {
          amount: true,
          term: { select: { id: true, name: true, amount: true } },
        },
      },
      _count: { select: { activities: true } },
    },
  });

  const data: LedgerRow[] = rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurredAt.toISOString(),
    bookingId: r.bookingId,
    clientName: r.booking.snapCustomer?.name ?? "-",
    direction: r.direction,
    ackStatus: r.ackStatus,
    amount: Number(r.amount),
    discountAmount: Number(r.discountAmount),
    cashAmount: Number(r.cashAmount),
    discountProgramName: r.discountProgram?.name ?? null,
    paymentMethod: r.paymentMethod
      ? `${r.paymentMethod.bankName} ${r.paymentMethod.bankAccountNumber.slice(-3)}`
      : null,
    invoiceNumber: r.invoiceNumber ?? null,
    evidence: r.evidence ?? null,
    notes: r.notes ?? null,
    voided: r.voidedAt !== null,
    createdByName: profileName(r.createdBy),
    acknowledgedByName: profileName(r.acknowledgedBy),
    linkedTermins: r.allocations.map((a) => ({
      id: a.term.id,
      name: a.term.name,
      amount: Number(a.term.amount),
      allocated: Number(a.amount),
    })),
    activityCount: r._count.activities,
  }));

  return { data, total: data.length };
}

export type LedgerEntriesResult = Awaited<ReturnType<typeof getLedgerEntries>>;

/* ─── Termin picker (entry drawer) ──────────────────────────────────────────────
 *
 * Jadwal termin satu booking buat multi-select link di drawer catat-transaksi.
 * NOT "use cache" — butuh fresh setiap booking dipilih (alokasi bisa berubah).
 */

export interface TermForBooking {
  id: string;
  name: string;
  amount: number;
  dueDate: string | null;
}

export async function getTermsForBooking(bookingId: string): Promise<TermForBooking[]> {
  const rows = await db.termOfPayment.findMany({
    where: { bookingId },
    select: { id: true, name: true, amount: true, dueDate: true },
    orderBy: { sortOrder: "asc" },
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    amount: Number(r.amount),
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
  }));
}

/* ─── Booking picker (entry drawer) ─────────────────────────────────────────────
 *
 * Daftar booking yang boleh dicatat cash-in-nya di drawer "Catat Transaksi":
 * booking non-draft yang SUDAH punya jadwal termin (kalau belum ada termin,
 * tidak ada yang bisa dialokasikan). Nama = snapshot customer (denormalized).
 */

export interface BookingPickerItem {
  id: string;
  clientName: string;
}

export async function getBookingsForLedgerPicker(): Promise<BookingPickerItem[]> {
  "use cache";
  cacheTag("ledger");
  cacheLife("minutes");

  const rows = await db.booking.findMany({
    where: {
      recordStatus: { not: "draft" },
      termOfPayments: { some: {} },
    },
    select: { id: true, snapCustomer: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return rows.map((r) => ({ id: r.id, clientName: r.snapCustomer?.name ?? "-" }));
}

/* ─── Activity log (riwayat transaksi) ──────────────────────────────────────────
 *
 * Riwayat satu Ledger dari PaymentActivity (created/ack/reject/void). Dipakai
 * modal Riwayat — di-fetch on-demand pas modal dibuka (bukan embed di LedgerRow).
 */

export type LedgerActivityAction =
  | "created"
  | "acknowledged"
  | "rejected"
  | "voided"
  | "updated"
  | "unacknowledged";

export interface LedgerActivity {
  id: string;
  action: LedgerActivityAction;
  actorName: string;
  actorRole: string | null;
  signatureDataUrl: string | null;
  note: string | null;
  createdAt: string;
}

export async function getLedgerActivities(ledgerId: string): Promise<LedgerActivity[]> {
  const rows = await db.paymentActivity.findMany({
    where: { ledgerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      actorNameSnapshot: true,
      signature: true,
      note: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action as LedgerActivityAction,
    actorName: r.actorNameSnapshot,
    actorRole: null,
    signatureDataUrl: r.signature ?? null,
    note: r.note ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
