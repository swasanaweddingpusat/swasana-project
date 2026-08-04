import { getBookingById } from "@/lib/queries/bookings";
import { getBookingCashIns, getTermPaidMap, deriveTermStatus } from "@/lib/queries/ledger";
import { requirePermissionForRoute } from "@/lib/permissions";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getPublicUrl } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;
  if (!apiLimiter.check(`booking-detail:${session.user.id}`)) return rateLimitResponse();
  const { id } = await params;
  const data = await getBookingById(id);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  // Status & bukti bayar tinggal di Ledger cashbook (Fase 5), bukan di TOP. Ditarik
  // read-only buat tab Pembayaran: status per termin diturunkan dari gross terbayar,
  // riwayat cash-in dibawa apa adanya (+ evidence key → URL, pola sama dgn doc.fileUrl).
  const [cashIns, paidMap] = await Promise.all([getBookingCashIns(id), getTermPaidMap(id)]);
  const now = new Date();

  const resolved = {
    ...data,
    bookingDocuments: data.bookingDocuments.map((doc) => ({
      ...doc,
      fileUrl: getPublicUrl(doc.filePath),
    })),
    // TOP kini jadwal murni — status diturunkan (§5), bukti bayar/riwayat dari Ledger.
    termOfPayments: data.termOfPayments,
    termStatuses: Object.fromEntries(
      data.termOfPayments.map((t) => [
        t.id,
        deriveTermStatus(Number(t.amount), Math.min(paidMap.get(t.id) ?? 0, Number(t.amount)), new Date(t.dueDate), now),
      ]),
    ),
    // evidenceUrl di-resolve server-side (key → full URL); FE tinggal pakai href.
    cashIns: cashIns.map((ci) => ({
      ...ci,
      evidenceUrl: ci.evidence ? getPublicUrl(ci.evidence) : null,
    })),
  };

  return new Response(JSON.stringify(resolved, (_k, v) => (typeof v === "bigint" ? Number(v) : v)), {
    headers: { "content-type": "application/json" },
  });
}
