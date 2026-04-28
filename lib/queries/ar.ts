import { db } from "@/lib/db";
import type { ARBooking, ARTermin, ARTerminStatus } from "@/types/finance";

function deriveTerminStatus(
  status: "unpaid" | "paid" | "partial",
  dueDate: Date,
  now: Date
): ARTerminStatus {
  if (status === "paid") return "paid";
  if (status === "partial") return "partial";
  return dueDate < now ? "overdue" : "not_due_yet";
}

function deriveBookingStatus(termins: ARTermin[]): ARTerminStatus {
  if (termins.every((t) => t.status === "paid")) return "paid";
  if (termins.some((t) => t.status === "overdue")) return "overdue";
  if (termins.some((t) => t.status === "partial")) return "partial";
  if (termins.some((t) => t.status === "unpaid")) return "unpaid";
  return "not_due_yet";
}

export async function getARBookings(): Promise<ARBooking[]> {
  const now = new Date();

  const bookings = await db.booking.findMany({
    where: {
      bookingStatus: "Confirmed",
      termOfPayments: { some: {} },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      poNumber: true,
      bookingDate: true,
      snapCustomer: { select: { name: true } },
      snapVenue: { select: { venueName: true } },
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
        },
      },
    },
  });

  return bookings.map((b) => {
    const termins: ARTermin[] = b.termOfPayments.map((t) => {
      const status = deriveTerminStatus(t.paymentStatus, t.dueDate, now);
      const agingDays =
        status === "overdue"
          ? Math.floor((now.getTime() - t.dueDate.getTime()) / 86_400_000)
          : null;

      return {
        id: t.id,
        name: t.name,
        dueDate: t.dueDate.toISOString(),
        amount: Number(t.amount),
        status,
        noInvoice: t.invoiceNumber ?? "",
        statusInvoice: t.invoiceNumber
          ? t.paymentStatus === "paid"
            ? "paid"
            : t.paymentStatus === "partial"
              ? "partial"
              : "unpaid"
          : "unissued",
        agingDays,
        catatan: t.notes ?? "",
      };
    });

    const totalPrice = termins.reduce((s, t) => s + t.amount, 0);
    const outstanding = termins
      .filter((t) => t.status !== "paid")
      .reduce((s, t) => s + t.amount, 0);

    const nextUnpaid = termins.find((t) => t.status !== "paid" && t.status !== "not_due_yet");
    const jatuhTempo = nextUnpaid?.dueDate ?? termins.at(-1)?.dueDate ?? "";

    return {
      id: b.id,
      noPo: b.poNumber ?? "-",
      customerEvent: b.snapCustomer?.name ?? "-",
      customerDate: b.bookingDate.toISOString(),
      namaEvent: b.snapVenue?.venueName ?? "-",
      totalPrice,
      outstanding,
      jatuhTempo,
      statusTermin: deriveBookingStatus(termins),
      termins,
    };
  });
}

export type ARBookingsResult = Awaited<ReturnType<typeof getARBookings>>;
