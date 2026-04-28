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
  termOfPayments: { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, amount: true, dueDate: true, sortOrder: true, paymentStatus: true, paymentEvidence: true, notes: true } },
} as const;

const bookingDetailInclude = {
  ...bookingListInclude,
  snapCustomer: true,
  snapVenue: true,
  snapPackage: true,
  snapPackageVariant: true,
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapBonuses: { include: { orderStatus: { select: { id: true, name: true } } } },
  snapVendorItems: true,
  termOfPayments: { orderBy: { sortOrder: "asc" as const } },
  bookingDocuments: { orderBy: { createdAt: "desc" as const } },
  bookingRefunds: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true, type: true, amount: true, status: true,
      notes: true, settledAt: true, createdAt: true,
      bookingId: true,
      paymentMethodId: true,
      targetBookingId: true,
      snapVendorItemId: true,
      paymentMethod: { select: { bankName: true, bankAccountNumber: true, bankRecipient: true } },
      targetBooking: { select: { id: true, snapCustomer: { select: { name: true } } } },
    },
  },
  paymentMethod: true,
  sourceOfInformation: true,
  clientAgreement: true,
} as const;

import type { DataScope } from "@/types/user";

export async function getBookings(profileId?: string, dataScope?: DataScope) {
  const where = await buildScopeFilter(profileId, dataScope);

  return db.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: bookingListInclude,
  });
}

async function buildScopeFilter(profileId?: string, dataScope?: DataScope) {
  if (!profileId || !dataScope || dataScope === "all") return {};
  if (dataScope === "own") return { salesId: profileId };

  // group: find all sales whose UserVenueAccess.managerId = this profileId
  const subordinateAccess = await db.userVenueAccess.findMany({
    where: { managerId: profileId },
    select: { userId: true },
  });
  const subordinateIds = [...new Set(subordinateAccess.map((a) => a.userId))];
  if (subordinateIds.length === 0) return { salesId: profileId }; // fallback to own

  return { salesId: { in: [...subordinateIds, profileId] } };
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
