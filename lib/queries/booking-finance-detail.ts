import { db } from "@/lib/db";

export interface BookingFinanceDetail {
  id: string;
  customerName: string;
  packagePrice: number;
  discountName: string | null;
  discountAmount: number;
  margin: number;
  terms: {
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    sortOrder: number;
    paymentStatus: "unpaid" | "paid" | "partial";
    ackStatus: string | null;
    paymentEvidence: string | null;
    notes: string | null;
    partialPayments: {
      id: string;
      amount: number;
      paidAt: string;
      evidence: string | null;
      notes: string | null;
    }[];
  }[];
  categories: {
    id: string;
    categoryName: string;
    basePrice: number;
    sortOrder: number;
    isShow: boolean;
    isTakeout: boolean;
  }[] | null;
}

export async function getBookingFinanceDetail(
  bookingId: string,
): Promise<BookingFinanceDetail | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      discountName: true,
      discountAmount: true,
      snapCustomer: { select: { name: true } },
      snapPackagePricing: { select: { price: true, margin: true } },
      termOfPayments: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          amount: true,
          dueDate: true,
          sortOrder: true,
          paymentStatus: true,
          ackStatus: true,
          paymentEvidence: true,
          notes: true,
          partialPayments: {
            orderBy: { paidAt: "asc" },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              evidence: true,
              notes: true,
            },
          },
        },
      },
      snapPackageCategoryPrices: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          categoryName: true,
          basePrice: true,
          sortOrder: true,
          isShow: true,
          isTakeout: true,
        },
      },
    },
  });

  if (!booking) return null;

  return {
    id: booking.id,
    customerName: booking.snapCustomer?.name ?? "",
    packagePrice: Number(booking.snapPackagePricing?.price ?? 0),
    discountName: booking.discountName ?? null,
    discountAmount: Number(booking.discountAmount ?? 0),
    margin: booking.snapPackagePricing?.margin ?? 0,
    terms: booking.termOfPayments.map((t) => ({
      id: t.id,
      name: t.name,
      amount: Number(t.amount),
      dueDate: new Date(t.dueDate).toISOString(),
      sortOrder: t.sortOrder,
      paymentStatus: t.paymentStatus as "unpaid" | "paid" | "partial",
      ackStatus: t.ackStatus ?? null,
      paymentEvidence: t.paymentEvidence ?? null,
      notes: t.notes ?? null,
      partialPayments: t.partialPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: new Date(p.paidAt).toISOString(),
        evidence: p.evidence ?? null,
        notes: p.notes ?? null,
      })),
    })),
    categories:
      booking.snapPackageCategoryPrices.length > 0
        ? booking.snapPackageCategoryPrices.map((c) => ({
            id: c.id,
            categoryName: c.categoryName,
            basePrice: Number(c.basePrice),
            sortOrder: c.sortOrder,
            isShow: c.isShow,
            isTakeout: c.isTakeout,
          }))
        : null,
  };
}
