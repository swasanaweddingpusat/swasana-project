import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

const bookingListInclude = {
  snapCustomer: { select: { name: true, mobileNumber: true } },
  snapVenue: { select: { venueName: true, brandCode: true } },
  snapPackage: { select: { packageName: true } },
  snapPackageVariant: { select: { variantName: true, pax: true, price: true } },
  sales: { select: { id: true, fullName: true } },
  manager: { select: { id: true, fullName: true } },
  paymentMethod: { select: { bankName: true } },
  sourceOfInformation: { select: { name: true } },
  clientAgreement: { select: { token: true, accessCode: true, status: true, expiresAt: true } },
} as const;

const bookingDetailInclude = {
  ...bookingListInclude,
  snapCustomer: true,
  snapVenue: true,
  snapPackage: true,
  snapPackageVariant: true,
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapBonuses: true,
  snapVendorItems: true,
  termOfPayments: { orderBy: { sortOrder: "asc" as const } },
  bookingDocuments: { orderBy: { createdAt: "desc" as const } },
  bookingRefunds: { orderBy: { createdAt: "desc" as const } },
  paymentMethod: true,
  sourceOfInformation: true,
  clientAgreement: true,
} as const;

export async function getBookings() {
  return db.booking.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: bookingListInclude,
  });
}

export async function getBookingById(id: string) {
  return db.booking.findUnique({
    where: { id },
    include: bookingDetailInclude,
  });
}

export type BookingsResult = Awaited<ReturnType<typeof getBookings>>;
export type BookingListItem = BookingsResult[number];
export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingById>>>;

export async function getSalesProfiles() {
  "use cache";
  cacheTag("users");
  cacheLife("minutes");

  return db.profile.findMany({
    where: { status: "active", role: { name: "sales" } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });
}

export type SalesProfile = Awaited<ReturnType<typeof getSalesProfiles>>[number];
