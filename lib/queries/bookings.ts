import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

const bookingListInclude = {
  snapCustomer: { select: { name: true, mobileNumber: true } },
  snapVenue: { select: { venueName: true, brandCode: true } },
  snapPackage: { select: { packageName: true } },
  snapPackageVariant: { select: { variantName: true, pax: true, price: true } },
  sales: { select: { id: true, fullName: true } },
  manager: { select: { id: true, fullName: true } },
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
} as const;

export async function getBookings() {
  "use cache";
  cacheTag("bookings");
  cacheLife("minutes");

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
