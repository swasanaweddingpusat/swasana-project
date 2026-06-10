import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import type { ARBooking, ARInvoiceStatus, ARPartialPayment, ARTermin, ARTerminStatus } from "@/types/finance";

function deriveTerminStatus(
  status: "unpaid" | "paid" | "partial" | "refund",
  dueDate: Date,
  now: Date
): ARTerminStatus {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  if (status === "refund") return "paid";
  return dueDate < now ? "overdue" : "not_due_yet";
}

function deriveBookingStatus(termins: ARTermin[]): ARTerminStatus {
  if (termins.every((t) => t.status === "paid")) return "paid";
  if (termins.some((t) => t.status === "overdue")) return "overdue";
  if (termins.some((t) => t.status === "partial")) return "partial";
  if (termins.some((t) => t.status === "unpaid")) return "unpaid";
  return "not_due_yet";
}

export async function getARBookings(): Promise<{ data: ARBooking[]; total: number }> {
  "use cache";
  cacheTag("ar-bookings");
  cacheLife("minutes");

  const now = new Date();

  const where = {
    recordStatus: "saved" as const,
    bookingStatus: "Confirmed" as const,
    termOfPayments: { some: {} },
  };

  // Hard cap: AR listing tidak boleh tak terbatas (AGENTS.md: findMany without pagination is forbidden)
  const bookings = await db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      poNumber: true,
      bookingDate: true,
      salesId: true,
      venueId: true,
      sales: { select: { fullName: true, nickName: true } },
      snapCustomer: { select: { name: true, emailCpp: true, emailCpw: true, mobileNumber: true } },
      snapVenue: { select: { venueName: true, venueId: true, brandName: true } },
      snapPackage: { select: { packageName: true } },
      termOfPayments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
          dueDate: true,
          paymentStatus: true,
          invoiceNumber: true,
          notes: true,
          ackStatus: true,
          acknowledgedAt: true,
          acknowledgedBy: { select: { fullName: true, nickName: true } },
          partialPayments: {
            select: { id: true, amount: true, paidAt: true, notes: true },
            orderBy: { paidAt: "asc" },
          },
        },
      },
    },
  });

  const mapped = bookings.map((b) => {
    const termins: ARTermin[] = b.termOfPayments.map((t) => {
      const status = deriveTerminStatus(t.paymentStatus, t.dueDate, now);
      const agingDays =
        status === "overdue"
          ? Math.floor((now.getTime() - t.dueDate.getTime()) / 86_400_000)
          : null;

      const partialPayments: ARPartialPayment[] = t.partialPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        notes: p.notes ?? null,
      }));

      const paidSoFar = partialPayments.reduce((s, p) => s + p.amount, 0);
      const remaining = status === "paid" ? 0 : Number(t.amount) - paidSoFar;

      const statusInvoice: ARInvoiceStatus = t.invoiceNumber
        ? t.paymentStatus === "paid"
          ? "paid"
          : t.paymentStatus === "partial"
            ? "partial"
            : "unpaid"
        : "unissued";

      return {
        id: t.id,
        name: t.name,
        dueDate: t.dueDate.toISOString(),
        amount: Number(t.amount),
        remaining,
        status,
        noInvoice: t.invoiceNumber ?? "",
        statusInvoice,
        agingDays,
        catatan: t.notes ?? "",
        partialPayments,
        ackStatus: (t.ackStatus ?? "pending") as "pending" | "acknowledged" | "rejected",
        acknowledgedAt: t.acknowledgedAt ? t.acknowledgedAt.toISOString() : null,
        acknowledgedByName: t.acknowledgedBy?.fullName ?? t.acknowledgedBy?.nickName ?? null,
      };
    });

    const totalPrice = termins.reduce((s, t) => s + t.amount, 0);
    const outstanding = termins
      .filter((t) => t.status !== "paid")
      .reduce((s, t) => s + t.remaining, 0);

    const nextDue = termins.find(
      (t) => t.status === "overdue" || t.status === "partial" || t.status === "unpaid"
    );
    const jatuhTempo =
      nextDue?.dueDate ??
      termins.find((t) => t.status === "not_due_yet")?.dueDate ??
      termins.at(-1)?.dueDate ??
      "";

    return {
      id: b.id,
      noPo: b.poNumber ?? "-",
      customerEvent: b.snapCustomer?.name ?? "-",
      customerEmail: b.snapCustomer?.emailCpp ?? b.snapCustomer?.emailCpw ?? "",
      customerPhone: b.snapCustomer?.mobileNumber ?? "",
      customerDate: b.bookingDate.toISOString(),
      namaEvent: b.snapVenue?.venueName ?? "-",
      brandName: b.snapVenue?.brandName ?? null,
      venueId: b.snapVenue?.venueId ?? b.venueId,
      salesId: b.salesId,
      salesPicName: b.sales?.fullName ?? b.sales?.nickName ?? "-",
      packageName: b.snapPackage?.packageName ?? null,
      totalPrice,
      outstanding,
      jatuhTempo,
      statusTermin: deriveBookingStatus(termins),
      termins,
    };
  });

  return { data: mapped, total: mapped.length };
}

export type ARBookingsResult = Awaited<ReturnType<typeof getARBookings>>;
