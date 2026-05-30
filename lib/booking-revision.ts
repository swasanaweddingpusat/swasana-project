import { db } from "@/lib/db";

const snapshotInclude = {
  snapCustomer: true,
  snapVenue: true,
  snapPackage: true,
  snapPackagePricing: true,
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapVendorItems: true,
  snapBonuses: true,
  termOfPayments: { orderBy: { sortOrder: "asc" as const } },
  paymentMethod: true,
  sales: { select: { fullName: true } },
  manager: { select: { fullName: true } },
} as const;

export async function createBookingRevision(
  bookingId: string,
  createdById: string,
  reason?: string,
): Promise<string> {
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
    snapCustomer: booking.snapCustomer,
    snapVenue: booking.snapVenue,
    snapPackage: booking.snapPackage,
    snapPackagePricing: booking.snapPackagePricing,
    snapPackageInternalItems: booking.snapPackageInternalItems,
    snapPackageVendorItems: booking.snapPackageVendorItems,
    snapVendorItems: booking.snapVendorItems,
    snapBonuses: booking.snapBonuses,
    termOfPayments: booking.termOfPayments,
    paymentMethod: booking.paymentMethod,
    sales: booking.sales,
    manager: booking.manager,
    discountName: booking.discountName,
    discountAmount: booking.discountAmount,
  };

  const revision = await db.bookingRevision.create({
    data: {
      bookingId,
      revisionNumber,
      reason: reason ?? (revisionNumber === 1 ? "Initial booking" : "Booking updated"),
      packageId: booking.packageId,
      packageName: booking.snapPackage?.packageName ?? "",
      pax: booking.snapPackagePricing?.pax ?? 0,
      price: booking.snapPackagePricing?.price ?? 0,
      venueId: booking.venueId,
      venueName: booking.snapVenue?.venueName ?? "",
      discountName: booking.discountName,
      discountAmount: booking.discountAmount,
      snapshotData,
      createdById,
    },
  });

  return revision.id;
}
