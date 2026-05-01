import { db } from "@/lib/db";

const snapshotInclude = {
  snapCustomer: true,
  snapVenue: true,
  snapPackage: true,
  snapPackageVariant: true,
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapVendorItems: true,
  snapBonuses: true,
  termOfPayments: { orderBy: { sortOrder: "asc" as const } },
  paymentMethod: true,
  sales: { select: { fullName: true } },
} as const;

export async function createBookingRevision(
  bookingId: string,
  createdById: string,
  reason?: string,
): Promise<void> {
  const booking = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: snapshotInclude,
  });

  const lastRevision = await db.bookingRevision.findFirst({
    where: { bookingId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });

  const revisionNumber = (lastRevision?.revisionNumber ?? 0) + 1;

  const snapshotData = {
    poNumber: booking.poNumber,
    bookingDate: booking.bookingDate,
    weddingSession: booking.weddingSession,
    weddingType: booking.weddingType,
    signingLocation: booking.signingLocation,
    signatures: booking.signatures,
    snapCustomer: booking.snapCustomer,
    snapVenue: booking.snapVenue,
    snapPackage: booking.snapPackage,
    snapPackageVariant: booking.snapPackageVariant,
    snapPackageInternalItems: booking.snapPackageInternalItems,
    snapPackageVendorItems: booking.snapPackageVendorItems,
    snapVendorItems: booking.snapVendorItems,
    snapBonuses: booking.snapBonuses,
    termOfPayments: booking.termOfPayments,
    paymentMethod: booking.paymentMethod,
    sales: booking.sales,
    discountName: booking.discountName,
    discountAmount: booking.discountAmount,
  };

  await db.bookingRevision.create({
    data: {
      bookingId,
      revisionNumber,
      reason: reason ?? (revisionNumber === 1 ? "Initial booking" : "Booking updated"),
      packageId: booking.packageId,
      packageName: booking.snapPackage?.packageName ?? "",
      variantId: booking.packageVariantId,
      variantName: booking.snapPackageVariant?.variantName ?? null,
      variantPrice: booking.snapPackageVariant?.price ?? 0,
      venueId: booking.venueId,
      venueName: booking.snapVenue?.venueName ?? "",
      discountName: booking.discountName,
      discountAmount: booking.discountAmount,
      snapshotData,
      createdById,
    },
  });
}
