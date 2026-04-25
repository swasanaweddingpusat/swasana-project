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

  // group: find all groups this user belongs to, get all member profileIds
  const memberships = await db.userGroupMember.findMany({
    where: { userId: profileId },
    select: { groupId: true },
  });
  if (memberships.length === 0) return { salesId: profileId }; // fallback to own

  const groupIds = memberships.map((m) => m.groupId);
  const allMembers = await db.userGroupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { userId: true },
  });
  const memberIds = [...new Set(allMembers.map((m) => m.userId))];
  return { salesId: { in: memberIds } };
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
export type SnapPackageInternalItem = BookingDetail["snapPackageInternalItems"][number];
export type SnapPackageVendorItem = BookingDetail["snapPackageVendorItems"][number];
export type SnapBonus = BookingDetail["snapBonuses"][number];
export type SnapVendorItem = BookingDetail["snapVendorItems"][number];
export type TermOfPayment = BookingDetail["termOfPayments"][number];
export type BookingDocument = BookingDetail["bookingDocuments"][number];
export type BookingClientAgreement = BookingDetail["clientAgreement"];

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
