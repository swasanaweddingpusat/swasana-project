"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { getNextSequence } from "@/lib/counter";
import { logAudit } from "@/lib/audit";
import { issueInvoiceSchema } from "@/lib/validations/invoice";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type ActionResult<T = undefined> =
  | (T extends undefined ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

/* ─── Invoice number generator (§6.3, FIX C) ────────────────────────────────── */

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/**
 * Nomor INVOICE (tagihan terbit) — BEDA dari nomor KWITANSI (`generateKwitansiNumber`,
 * actions/ledger.ts, bulan ANGKA). Invoice pakai bulan ROMAWI, sama format persis
 * dgn mint lama di `booking-draft.ts` (sebelum FIX C): `<seq>/INV/<venue>/<bln-romawi>/<thn>`.
 * Sequence atomik via `@/lib/counter`, key `invoice-<year>` — SAMA counter dgn mint
 * lama, jadi gapless tetap terjaga lintas cara-mint (borongan dulu vs on-demand sekarang).
 */
async function generateInvoiceNumber(venueCode: string, issuedAt: Date): Promise<string> {
  const year = issuedAt.getFullYear();
  const seq = await getNextSequence(`invoice-${year}`);
  const monthRoman = ROMAN[issuedAt.getMonth()];
  return `${seq}/INV/${venueCode}/${monthRoman}/${year}`;
}

/* ─── Issue invoice (on-demand, 1:1) ─────────────────────────────────────────── */

/**
 * Terbitkan invoice buat 1 termin (finance trigger "Terbitkan Invoice"). Nomor
 * gapless (getNextSequence), `amount` BEKU = snapshot `termin.amount` (net) SAAT
 * terbit — bukan baca live dari TermOfPayment lagi setelah ini. Guard: 1 termin
 * cuma boleh punya 1 invoice AKTIF (status=issued) — kalau udah ada & belum
 * di-void, tolak (harus void yang lama dulu sebelum re-issue).
 */
export async function issueInvoice(
  input: unknown,
): Promise<ActionResult<{ id: string; invoiceNumber: string }>> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`invoice-issue:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = issueInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const data = parsed.data;

  try {
    const term = await db.termOfPayment.findUnique({
      where: { id: data.termId },
      select: {
        id: true,
        amount: true,
        bookingId: true,
        booking: { select: { venue: { select: { code: true } } } },
      },
    });
    if (!term) return { success: false, error: "Termin tidak ditemukan." };

    // Guard: 1 termin = maksimal 1 invoice AKTIF (issued, belum void).
    const existing = await db.invoice.findFirst({
      where: { termId: data.termId, status: "issued" },
      select: { id: true },
    });
    if (existing) {
      return {
        success: false,
        error: "Termin ini sudah punya invoice aktif. Void invoice lama dulu sebelum menerbitkan yang baru.",
      };
    }

    // amount BEKU (net) — snapshot termin.amount SAAT terbit (§6.3).
    const amount = Number(term.amount);
    const issuedAt = new Date();
    const invoiceNumber = await generateInvoiceNumber(term.booking.venue.code, issuedAt);
    const invoiceId = crypto.randomUUID();
    const profileId = session!.user.profileId!;

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.invoice.create({
        data: {
          id: invoiceId,
          bookingId: term.bookingId,
          termId: term.id,
          invoiceNumber,
          invoiceType: data.invoiceType,
          amount,
          dueDate: data.dueDate ?? null,
          notes: data.notes ?? null,
          status: "issued",
          issuedAt,
          issuedById: profileId,
        },
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "invoice.issued",
      entityType: "invoice",
      entityId: invoiceId,
      changes: { termId: term.id, bookingId: term.bookingId, amount, invoiceNumber },
      description: `Invoice ${invoiceNumber} diterbitkan`,
    });

    revalidateTag("ar-bookings", "max");
    revalidateTag("invoices", "max");
    return { success: true, data: { id: invoiceId, invoiceNumber } };
  } catch (e) {
    console.error("[issueInvoice]", e);
    return { success: false, error: "Gagal menerbitkan invoice." };
  }
}

/* ─── Void invoice (tombstone) ───────────────────────────────────────────────── */

/**
 * Batalkan invoice yang SUDAH terbit (koreksi non-destruktif — row tidak pernah
 * dihapus, cuma ditandai voidedAt). Hanya invoice `status=issued` yang boleh
 * di-void. Nomor invoice yang udah void TIDAK dipakai ulang — reissue = nomor baru.
 */
export async function voidInvoice(invoiceId: string): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`invoice-void:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  if (typeof invoiceId !== "string" || invoiceId.length === 0) {
    return { success: false, error: "ID invoice tidak valid." };
  }

  try {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, status: true },
    });
    if (!invoice) return { success: false, error: "Invoice tidak ditemukan." };
    if (invoice.status !== "issued") {
      return { success: false, error: "Hanya invoice aktif (issued) yang bisa dibatalkan." };
    }

    const profileId = session!.user.profileId!;
    const now = new Date();

    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.invoice.update({
        where: { id: invoiceId },
        data: { status: "void", voidedAt: now, voidedById: profileId },
      }),
    ];

    await db.$transaction(ops);

    await logAudit({
      userId: session!.user.id,
      action: "invoice.voided",
      entityType: "invoice",
      entityId: invoiceId,
      description: `Invoice ${invoiceId} dibatalkan`,
    });

    revalidateTag("ar-bookings", "max");
    revalidateTag("invoices", "max");
    return { success: true };
  } catch (e) {
    console.error("[voidInvoice]", e);
    return { success: false, error: "Gagal membatalkan invoice." };
  }
}
