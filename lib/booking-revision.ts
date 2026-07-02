import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const snapshotInclude = {
  snapCustomer: true,
  snapVenue: true,
  snapPackage: true,
  snapPackagePricing: true,
  snapPackageInternalItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageVendorItems: { orderBy: { sortOrder: "asc" as const } },
  snapPackageCategoryPrices: { orderBy: { sortOrder: "asc" as const } },
  snapComplimentaries: { orderBy: { sortOrder: "asc" as const } },
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
    // Single LATERAL JOIN — snapshotInclude pulls ~13 relations; the default
    // per-relation round-tripping over Neon HTTP made this a major finalize cost.
    relationLoadStrategy: "join",
    include: snapshotInclude,
  });

  // Guard: a revision snapshot MUST have the core snap rows. If they're missing
  // (upstream bug — snap tables not written before revision creation), fail loudly
  // here instead of persisting a partial-null snapshotData that crashes render-po later.
  if (!booking.snapCustomer || !booking.snapVenue || !booking.snapPackagePricing) {
    throw new Error(
      `[createBookingRevision] booking ${bookingId} missing snapshot rows (customer/venue/pricing) — cannot build revision`,
    );
  }

  // Atomic per-booking revision number. Previously this read MAX(revisionNumber)+1
  // then created — two concurrent edits could compute the same number and collide
  // on @@unique([bookingId, revisionNumber]) (unique violation). We use a per-booking
  // counter row, atomically incremented. The counter self-seeds from the existing
  // MAX(revisionNumber) so bookings created before this change don't restart at 1
  // and collide with their existing revisions. (B-2)
  const counterKey = `revision-${bookingId}`;
  const [seeded] = await db.$queryRaw<[{ value: number }]>(
    Prisma.sql`
      INSERT INTO counters (id, value)
      VALUES (
        ${counterKey},
        (SELECT COALESCE(MAX("revisionNumber"), 0) + 1 FROM booking_revisions WHERE "bookingId" = ${bookingId})
      )
      ON CONFLICT (id) DO UPDATE SET value = counters.value + 1
      RETURNING value
    `,
  );
  const revisionNumber = seeded.value;

  const snapshotData = {
    poNumber: booking.poNumber,
    eventDate: booking.eventDate,
    weddingSession: booking.weddingSession,
    weddingType: booking.weddingType,
    signingLocation: booking.signingLocation,
    snapCustomer: booking.snapCustomer,
    snapVenue: booking.snapVenue,
    snapPackage: booking.snapPackage,
    snapPackagePricing: booking.snapPackagePricing,
    snapPackageInternalItems: booking.snapPackageInternalItems,
    snapPackageVendorItems: booking.snapPackageVendorItems,
    snapPackageCategoryPrices: booking.snapPackageCategoryPrices,
    snapComplimentaries: booking.snapComplimentaries,
    snapVendorItems: booking.snapVendorItems,
    snapBonuses: booking.snapBonuses,
    termOfPayments: booking.termOfPayments,
    paymentMethod: booking.paymentMethod,
    sales: booking.sales,
    manager: booking.manager,
    discountName: booking.discountName,
    discountAmount: booking.discountAmount,
  };

  // BookingRevision.packageId is non-nullable — revisions are only created for wedding
  // bookings which always have a package (enforced by Zod at creation/edit time).
  if (!booking.packageId) {
    throw new Error(`[createBookingRevision] booking ${bookingId} has no packageId — only wedding bookings should create revisions`);
  }
  const packageId = booking.packageId;

  const revision = await db.bookingRevision.create({
    data: {
      bookingId,
      revisionNumber,
      reason: reason ?? (revisionNumber === 1 ? "Initial booking" : "Booking updated"),
      packageId,
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
