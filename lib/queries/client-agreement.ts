import { db } from "@/lib/db";

export async function getAgreementByBookingId(bookingId: string) {
  return db.clientAgreement.findUnique({
    where: { bookingId },
  });
}

export async function getAgreementByToken(token: string) {
  return db.clientAgreement.findUnique({
    where: { token },
    include: {
      booking: {
        include: {
          customer: true,
          venue: { include: { brand: true } },
          package: true,
          snapCustomer: true,
          snapVenue: true,
          snapPackage: true,
          snapPackageVariant: true,
          snapPackageVendorItems: true,
          snapVendorItems: true,
          termOfPayments: { orderBy: { dueDate: "asc" } },
          paymentMethod: true,
        },
      },
    },
  });
}

export type AgreementQueryResult = Awaited<ReturnType<typeof getAgreementByBookingId>>;
export type AgreementWithBooking = Awaited<ReturnType<typeof getAgreementByToken>>;
