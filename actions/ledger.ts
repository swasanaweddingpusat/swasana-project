"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, requireAnyPermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { logAudit } from "@/lib/audit";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type ActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/* ─── Kwitansi number generator (§7.2) ──────────────────────────────────────── */

/**
 * Nomor kwitansi (bukti terima cash-in). BEDA dari nomor INVOICE (TOP, pakai Romawi).
 * KWITANSI pakai bulan ANGKA — dua dokumen berbeda, jangan ketuker.
 * Pola: `<seq>/KW/<brand>/<venue>/<bln-angka>/<thn>`, contoh `0006/KW/GWN/SMSR/07/2026`.
 * Sequence atomik via `@/lib/counter` (reuse pola poNumber/invoice). Bulan = ANGKA 2-digit.
 */
export async function generateKwitansiNumber(
  brandCode: string,
  venueCode: string,
  occurredAt: Date,
): Promise<string> {
  const year = occurredAt.getFullYear();
  const month = (occurredAt.getMonth() + 1).toString().padStart(2, "0");
  const seq = await getNextSequence(`kwitansi-${year}`);
  return `${seq.toString().padStart(4, "0")}/KW/${brandCode}/${venueCode}/${month}/${year}`;
}

/* ─── Schemas ───────────────────────────────────────────────────────────────── */

const allocationInputSchema = z.object({
  termId: z.string().min(1),
  amount: z.number().int().positive(),
});

const createCashInSchema = z.object({
  bookingId: z.string().min(1, "Booking wajib dipilih"),
  occurredAt: z.string().min(1, "Tanggal transaksi wajib diisi"),
  /** GROSS — nominal yang meng-offset termin (§6.4). Rupiah penuh (Int). */
  amount: z.number().int().positive("Jumlah harus lebih dari 0"),
  paymentMethodId: z.string().min(1).nullable().optional(),
  discountProgramId: z.string().min(1).nullable().optional(),
  /** Potongan promo (contra-revenue). 0 = tanpa promo. */
  discountAmount: z.number().int().min(0).default(0),
  evidence: z.string().min(1).nullable().optional(),
  notes: z.string().max(500, "Keterangan maksimal 500 karakter").nullable().optional(),
  /** Alokasi ke termin — boleh kosong (unallocated = titipan/overpayment, §6.5 #4). */
  allocations: z.array(allocationInputSchema).default([]),
  /** Tampilkan cash-in ini di Summary Payment PO PDF. Default OFF. */
  showInPo: z.boolean().default(false),
});

export type CreateCashInInput = z.infer<typeof createCashInSchema>;

/* ─── Allocation guard (§6.5) ───────────────────────────────────────────────── */

/** Termin yang tervalidasi lolos alokasi — dioper balik ke caller biar gak query dobel. */
interface AllocationTerm {
  id: string;
  name: string;
  amount: number;
  sortOrder: number;
}

interface AllocationValidation {
  error: string | null;
  /** Termin yang dialokasikan di request ini (kosong kalau alokasi kosong atau error). */
  terms: AllocationTerm[];
}

/**
 * Validasi alokasi cash-in terhadap constraint §6.5:
 *  #1 per-termId: Σ alokasi (dari ledger in ter-ack + row baru) ≤ TermOfPayment.amount
 *  #2 per-ledger: Σ alokasi row ini ≤ amount cash-in
 * Row void di-exclude dari perhitungan existing (voidedAt != null tidak menghitung).
 * Return `terms` (dgn sortOrder) biar caller (createCashIn) bisa resolve snapTopName
 * tanpa query TermOfPayment lagi (FIX B).
 */
async function validateAllocations(
  bookingId: string,
  cashInAmount: number,
  allocations: { termId: string; amount: number }[],
  excludeLedgerId?: string,
): Promise<AllocationValidation> {
  if (allocations.length === 0) return { error: null, terms: [] };

  // #2 — total alokasi tidak boleh melebihi nominal cash-in
  const totalAlloc = allocations.reduce((s, a) => s + a.amount, 0);
  if (totalAlloc > cashInAmount) {
    return { error: "Total alokasi melebihi jumlah yang dibayar.", terms: [] };
  }

  // Termin harus milik booking yang sama
  const termIds = allocations.map((a) => a.termId);
  const terms = await db.termOfPayment.findMany({
    where: { id: { in: termIds }, bookingId },
    select: { id: true, amount: true, name: true, sortOrder: true },
  });
  if (terms.length !== new Set(termIds).size) {
    return { error: "Ada termin yang tidak valid untuk booking ini.", terms: [] };
  }

  // #1 — existing alokasi (dari ledger ter-ack, non-void) per termin
  const existing = await db.paymentAllocation.groupBy({
    by: ["termId"],
    where: {
      termId: { in: termIds },
      ledger: {
        direction: "in",
        ackStatus: "acknowledged",
        voidedAt: null,
        ...(excludeLedgerId ? { id: { not: excludeLedgerId } } : {}),
      },
    },
    _sum: { amount: true },
  });
  const existingByTerm = new Map(existing.map((e) => [e.termId, e._sum.amount ?? 0]));

  for (const alloc of allocations) {
    const term = terms.find((t) => t.id === alloc.termId);
    if (!term) continue;
    const already = existingByTerm.get(alloc.termId) ?? 0;
    if (already + alloc.amount > term.amount) {
      return { error: `Alokasi ke termin "${term.name}" melebihi sisa tagihan.`, terms: [] };
    }
  }

  return { error: null, terms };
}

/* ─── Create cash-in ────────────────────────────────────────────────────────── */

/**
 * Catat transaksi cash-in (uang masuk) + alokasi ke termin.
 * Lahir dengan ackStatus = pending (butuh verifikasi Finance) + activity "created".
 * Nomor kwitansi digenerate di sini (numeric month §7.2).
 */
export async function createCashIn(
  input: CreateCashInInput,
): Promise<ActionResult<{ ledgerId: string; invoiceNumber: string }>> {
  const { session, error } = await requireAnyPermission([
    { module: "booking", action: "edit" },
    { module: "finance-ar", action: "create" },
  ]);
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createCashInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  // Invariant §7.3: cashAmount = amount - discountAmount, tidak boleh negatif.
  const cashAmount = data.amount - data.discountAmount;
  if (cashAmount < 0) {
    return { success: false, error: "Potongan promo melebihi jumlah pembayaran." };
  }

  try {
    // Booking + venue/brand code (buat nomor kwitansi) + snap package/venue (freeze label, FIX B)
    const booking = await db.booking.findUnique({
      where: { id: data.bookingId },
      select: {
        id: true,
        venue: { select: { code: true, brand: { select: { code: true } } } },
        snapPackagePricing: { select: { packageName: true } },
        snapVenue: { select: { venueName: true } },
      },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    // Constraint §6.5 — terms dioper balik buat resolve snapTopName (FIX B), no query dobel.
    const allocResult = await validateAllocations(data.bookingId, data.amount, data.allocations);
    if (allocResult.error) return { success: false, error: allocResult.error };

    // Freeze konteks pembayaran (FIX B): nama termin ber-sortOrder terkecil di antara
    // termin yang dialokasikan. Alokasi kosong -> null (titipan/overpayment belum ke termin).
    const snapTopName =
      allocResult.terms.length > 0
        ? [...allocResult.terms].sort((a, b) => a.sortOrder - b.sortOrder)[0].name
        : null;

    const occurredAt = new Date(data.occurredAt);
    const invoiceNumber = await generateKwitansiNumber(
      booking.venue.brand?.code ?? "",
      booking.venue.code,
      occurredAt,
    );

    const ledgerId = crypto.randomUUID();
    const profileId = session!.user.profileId!;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.ledger.create({
        data: {
          id: ledgerId,
          bookingId: data.bookingId,
          direction: "in",
          ackStatus: "pending",
          paymentStatus: "paid",
          occurredAt,
          amount: data.amount,
          discountProgramId: data.discountProgramId ?? null,
          discountAmount: data.discountAmount,
          cashAmount,
          paymentMethodId: data.paymentMethodId ?? null,
          evidence: data.evidence ?? null,
          invoiceNumber,
          notes: data.notes ?? null,
          showInPo: data.showInPo,
          snapTopName,
          snapPackageName: booking.snapPackagePricing?.packageName ?? null,
          snapVenueName: booking.snapVenue?.venueName ?? null,
          createdById: profileId,
        },
      }),
      ...data.allocations.map((a) =>
        db.paymentAllocation.create({
          data: { ledgerId, termId: a.termId, amount: a.amount },
        }),
      ),
      db.paymentActivity.create({
        data: {
          ledgerId,
          action: "created",
          actorId: profileId,
          actorNameSnapshot: session!.user.name ?? "Sales",
          note: data.notes ?? null,
        },
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "ledger.created",
      entityType: "ledger",
      entityId: ledgerId,
      changes: { bookingId: data.bookingId, amount: data.amount, invoiceNumber },
      description: `Cash-in ${invoiceNumber} dicatat`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true, data: { ledgerId, invoiceNumber } };
  } catch (e) {
    console.error("[createCashIn]", e);
    return { success: false, error: "Gagal mencatat transaksi." };
  }
}

/* ─── Acknowledge cash-in ───────────────────────────────────────────────────── */

const ackSchema = z.object({
  ledgerId: z.string().min(1, "ID transaksi tidak valid"),
  /** Tanda tangan Finance (data URL PNG). */
  signature: z.string().min(1, "Tanda tangan wajib diisi"),
});

/**
 * Verifikasi cash-in oleh Finance (dana benar diterima). Set ackStatus = acknowledged
 * + snapshot ttd + activity "acknowledged". Setelah ini row IMMUTABLE (§6.5).
 * Re-validasi alokasi terhadap constraint #1 (bisa saja termin sudah penuh dari cash-in lain).
 */
export async function acknowledgeCashIn(
  input: z.infer<typeof ackSchema>,
): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-ack:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = ackSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { ledgerId, signature } = parsed.data;

  try {
    const ledger = await db.ledger.findUnique({
      where: { id: ledgerId },
      select: {
        id: true,
        bookingId: true,
        amount: true,
        ackStatus: true,
        voidedAt: true,
        allocations: { select: { termId: true, amount: true } },
      },
    });
    if (!ledger) return { success: false, error: "Transaksi tidak ditemukan." };
    if (ledger.voidedAt) return { success: false, error: "Transaksi sudah dibatalkan." };
    if (ledger.ackStatus === "acknowledged") {
      return { success: false, error: "Transaksi ini sudah diverifikasi." };
    }
    if (ledger.ackStatus === "rejected") {
      return { success: false, error: "Transaksi sudah ditolak, tidak bisa diverifikasi." };
    }

    // Re-validasi alokasi — exclude row ini sendiri (belum ter-ack jadi belum kehitung, tapi aman).
    const allocResult = await validateAllocations(
      ledger.bookingId,
      ledger.amount,
      ledger.allocations,
      ledgerId,
    );
    if (allocResult.error) return { success: false, error: allocResult.error };

    const now = new Date();
    const profileId = session!.user.profileId!;

    await db.$transaction([
      db.ledger.update({
        where: { id: ledgerId },
        data: {
          ackStatus: "acknowledged",
          acknowledgedAt: now,
          acknowledgedById: profileId,
          acknowledgedSignature: signature,
        },
      }),
      db.paymentActivity.create({
        data: {
          ledgerId,
          action: "acknowledged",
          actorId: profileId,
          actorNameSnapshot: session!.user.name ?? "Finance",
          signature,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "ledger.acknowledged",
      entityType: "ledger",
      entityId: ledgerId,
      description: `Cash-in ${ledgerId} diverifikasi`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[acknowledgeCashIn]", e);
    return { success: false, error: "Gagal memverifikasi transaksi." };
  }
}

/* ─── Reject cash-in ────────────────────────────────────────────────────────── */

const rejectSchema = z.object({
  ledgerId: z.string().min(1, "ID transaksi tidak valid"),
  note: z.string().min(1, "Alasan penolakan wajib diisi").max(500),
});

/**
 * Tolak cash-in (mis. mutasi tidak ketemu). Hanya row `pending` yang bisa ditolak.
 * Set ackStatus = rejected + activity "rejected". Alokasi otomatis tidak terhitung
 * di AR karena derived status cuma baca ledger ter-ack.
 */
export async function rejectCashIn(input: z.infer<typeof rejectSchema>): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-reject:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { ledgerId, note } = parsed.data;

  try {
    const ledger = await db.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, ackStatus: true, voidedAt: true },
    });
    if (!ledger) return { success: false, error: "Transaksi tidak ditemukan." };
    if (ledger.voidedAt) return { success: false, error: "Transaksi sudah dibatalkan." };
    if (ledger.ackStatus !== "pending") {
      return { success: false, error: "Hanya transaksi menunggu verifikasi yang bisa ditolak." };
    }

    const profileId = session!.user.profileId!;

    await db.$transaction([
      db.ledger.update({
        where: { id: ledgerId },
        data: { ackStatus: "rejected" },
      }),
      db.paymentActivity.create({
        data: {
          ledgerId,
          action: "rejected",
          actorId: profileId,
          actorNameSnapshot: session!.user.name ?? "Finance",
          note,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "ledger.rejected",
      entityType: "ledger",
      entityId: ledgerId,
      description: `Cash-in ${ledgerId} ditolak: ${note}`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[rejectCashIn]", e);
    return { success: false, error: "Gagal menolak transaksi." };
  }
}

/* ─── Void cash-in ──────────────────────────────────────────────────────────── */

const voidSchema = z.object({
  ledgerId: z.string().min(1, "ID transaksi tidak valid"),
  note: z.string().min(1, "Alasan pembatalan wajib diisi").max(500),
});

/**
 * Batalkan cash-in yang SUDAH ter-ack (koreksi non-destruktif §6.5). Row tidak dihapus/
 * di-overwrite — cuma ditandai voidedAt. Derived AR/query WAJIB exclude voidedAt != null,
 * jadi alokasinya otomatis tidak lagi menutup termin. Untuk reissue: buat cash-in baru.
 */
export async function voidCashIn(input: z.infer<typeof voidSchema>): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-void:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { ledgerId, note } = parsed.data;

  try {
    const ledger = await db.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true, ackStatus: true, voidedAt: true },
    });
    if (!ledger) return { success: false, error: "Transaksi tidak ditemukan." };
    if (ledger.voidedAt) return { success: false, error: "Transaksi sudah dibatalkan." };

    const profileId = session!.user.profileId!;
    const now = new Date();

    await db.$transaction([
      db.ledger.update({
        where: { id: ledgerId },
        data: { voidedAt: now, voidedById: profileId },
      }),
      db.paymentActivity.create({
        data: {
          ledgerId,
          action: "voided",
          actorId: profileId,
          actorNameSnapshot: session!.user.name ?? "Finance",
          note,
        },
      }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "ledger.voided",
      entityType: "ledger",
      entityId: ledgerId,
      description: `Cash-in ${ledgerId} dibatalkan: ${note}`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[voidCashIn]", e);
    return { success: false, error: "Gagal membatalkan transaksi." };
  }
}

/* ─── Toggle show-in-PO ──────────────────────────────────────────────────────── */

const setShowInPoSchema = z.object({
  ledgerId: z.string().min(1, "ID transaksi tidak valid"),
  value: z.boolean(),
});

/**
 * Set flag `showInPo` satu cash-in — nandain apakah pembayaran ini tampil di
 * Summary Payment PO PDF. Single-table update; tetap logAudit + revalidate.
 * Row void boleh di-toggle (harmless — render PO tetap exclude voidedAt != null).
 */
export async function setLedgerShowInPo(
  input: z.infer<typeof setShowInPoSchema>,
): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-showinpo:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = setShowInPoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { ledgerId, value } = parsed.data;

  try {
    const ledger = await db.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true },
    });
    if (!ledger) return { success: false, error: "Transaksi tidak ditemukan." };

    await db.ledger.update({
      where: { id: ledgerId },
      data: { showInPo: value },
    });

    await logAudit({
      userId: session!.user.id,
      action: "ledger.show_in_po_toggled",
      entityType: "ledger",
      entityId: ledgerId,
      changes: { showInPo: value },
      description: `Cash-in ${ledgerId} showInPo = ${value}`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[setLedgerShowInPo]", e);
    return { success: false, error: "Gagal mengubah tampilan PO." };
  }
}
