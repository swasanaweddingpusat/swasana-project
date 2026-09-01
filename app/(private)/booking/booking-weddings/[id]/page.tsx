import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getBookingById } from "@/lib/queries/bookings";
import { getBookingCashIns, getTermPaidMap, deriveTermStatus } from "@/lib/queries/ledger";
import { getPublicUrl } from "@/lib/storage";
import { canAccessBooking } from "@/lib/access-control";
import { BookingDetailClient } from "./_components/BookingDetailClient";
import type { BookingDetailResolved } from "./_components/BookingDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BookingWeddingDetailPage({ params }: Props) {
  const { id } = await params;

  await connection();
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  // ── Authorization: module-level view permission (super-admin bypasses) ──
  const isAdmin = session.user.isSuperAdmin;
  if (!isAdmin) {
    const canView = await hasPermission(session.user.roleId, "booking", "view");
    if (!canView) redirect("/forbidden");
  }

  // ── Defense-in-depth: this URL is directly navigable (unlike the modal, which
  // is only reachable from an already dataScope-filtered list). Enforce the same
  // per-record scope here so a sales rep can't read another team's booking by
  // guessing the id. A scope miss returns notFound (don't confirm existence). ──
  const profileId = session.user.profileId;
  if (!isAdmin && !profileId) redirect("/forbidden");
  const scope = session.user.dataScope ?? "own";

  // getBookingById and the per-record scope check are independent of each
  // other's result (neither needs `data`, neither needs `allowed`) — run them
  // in parallel instead of a waterfall.
  const [data, allowed] = await Promise.all([
    getBookingById(id),
    isAdmin ? Promise.resolve(true) : canAccessBooking(profileId, scope, id),
  ]);

  if (!data) notFound();
  if (!isAdmin && !allowed) notFound();

  // Status termin + riwayat cash-in di-resolve server-side (pola sama dgn
  // GET /api/bookings/[id]): status termin diturunkan dari gross terbayar,
  // evidence key → URL, dokumen filePath → URL.
  const [cashIns, paidMap] = await Promise.all([getBookingCashIns(id), getTermPaidMap(id)]);
  const now = new Date();

  const resolved = {
    ...data,
    bookingDocuments: data.bookingDocuments.map((doc) => ({
      ...doc,
      fileUrl: getPublicUrl(doc.filePath),
    })),
    clientAgreementUploaded: data.clientAgreementUploaded
      ? { ...data.clientAgreementUploaded, fileUrl: getPublicUrl(data.clientAgreementUploaded.path) }
      : null,
    termOfPayments: data.termOfPayments,
    termStatuses: Object.fromEntries(
      data.termOfPayments.map((t) => [
        t.id,
        deriveTermStatus(
          Number(t.amount),
          Math.min(paidMap.get(t.id) ?? 0, Number(t.amount)),
          new Date(t.dueDate),
          now,
        ),
      ]),
    ),
    cashIns: cashIns.map((ci) => ({
      ...ci,
      evidenceUrl: ci.evidence ? getPublicUrl(ci.evidence) : null,
    })),
  };

  // Signature metric — progres pembayaran: gross terbayar (capped per termin
  // biar promo/overpay gak bikin >100%) vs total nilai jadwal termin.
  const totalValue = data.termOfPayments.reduce((s, t) => s + Number(t.amount), 0);
  const totalPaid = data.termOfPayments.reduce(
    (s, t) => s + Math.min(paidMap.get(t.id) ?? 0, Number(t.amount)),
    0,
  );
  const payment = {
    totalValue,
    totalPaid,
    remaining: Math.max(0, totalValue - totalPaid),
    percent: totalValue > 0 ? Math.round((totalPaid / totalValue) * 100) : 0,
  };

  // BigInt tidak bisa nyebrang RSC boundary — serialisasi ke Number (pola sama
  // dgn route handler). Date ikut jadi ISO string; helper FE terima string|Date.
  const serialized = JSON.parse(
    JSON.stringify(resolved, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  ) as BookingDetailResolved;

  return (
    <div className="pb-10 pt-1">
      <BookingDetailClient booking={serialized} payment={payment} />
    </div>
  );
}
