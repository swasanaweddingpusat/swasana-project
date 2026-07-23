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

type BookingWithSnapshot = Prisma.BookingGetPayload<{ include: typeof snapshotInclude }>;

// Serialize the current live snap/TOP state into the JSON shape stored on
// BookingRevision.snapshotData. Shared by createBookingRevision (initial freeze)
// and refreshCurrentRevisionSnapshot (in-flight re-freeze after takeout/TOP edits).
function buildSnapshotData(booking: BookingWithSnapshot) {
  return {
    poNumber: booking.poNumber,
    eventDate: booking.eventDate,
    weddingSession: booking.weddingSession,
    weddingType: booking.weddingType,
    signingLocation: booking.signingLocation,
    notes: booking.notes,
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
}

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

  const snapshotData = buildSnapshotData(booking);

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

/**
 * Re-serialize the current live snap/TOP state into the booking's CURRENT revision
 * snapshot. Needed because the edit continue-flow creates the revision at Step 2
 * (material change) BEFORE takeout (saveSnapTakeout) and TOP (updateTermOfPayments)
 * are applied — those steps write live tables only, leaving the revision snapshot
 * (which the PO PDF renders from) stale.
 *
 * Guarded: only refreshes when the revision is still IN-FLIGHT — i.e. the snapshot
 * is NOT frozen (client hasn't signed yet). A signed/historical revision is left
 * untouched so a post-signature ops edit can never rewrite what the client agreed to.
 *
 * No-ops silently (returns false) when there is no current revision or it is frozen.
 * Best-effort by design: callers treat failure as non-fatal (the live tables — the
 * source of truth for the app UI — were already updated in their own transaction).
 */
export async function refreshCurrentRevisionSnapshot(bookingId: string): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { currentRevisionId: true, snapshotFrozenAt: true },
  });
  if (!booking?.currentRevisionId) return false;
  // Frozen = client already signed this revision → never rewrite an agreed snapshot.
  if (booking.snapshotFrozenAt != null) return false;

  const full = await db.booking.findUnique({
    where: { id: bookingId },
    relationLoadStrategy: "join",
    include: snapshotInclude,
  });
  if (!full || !full.snapCustomer || !full.snapVenue || !full.snapPackagePricing) return false;

  const snapshotData = buildSnapshotData(full);

  await db.bookingRevision.update({
    where: { id: booking.currentRevisionId },
    data: {
      snapshotData,
      // Keep denormalized columns in sync (used by revision list / PO filename).
      pax: full.snapPackagePricing?.pax ?? 0,
      price: full.snapPackagePricing?.price ?? 0,
      discountName: full.discountName,
      discountAmount: full.discountAmount,
    },
  });

  return true;
}

/**
 * Targeted patch of administrative-only snapshot fields that do NOT affect pricing,
 * package, or client-agreed terms. Called after a non-material editBooking save so
 * that the frozen revision snapshot stays in sync for the signed PO PDF.
 *
 * Unlike refreshCurrentRevisionSnapshot, this helper intentionally writes EVEN when
 * snapshotFrozenAt is set — the whole point is to propagate ops edits (signingLocation)
 * into a signed snapshot without re-opening approval or client agreement.
 *
 * No-ops silently when there is no current revision (booking never went through
 * approval). Best-effort: callers treat failure as non-fatal.
 */
export async function patchSnapshotAdminFields(bookingId: string): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { currentRevisionId: true, signingLocation: true, notes: true },
  });
  if (!booking?.currentRevisionId) return false;

  const revision = await db.bookingRevision.findUnique({
    where: { id: booking.currentRevisionId },
    select: { snapshotData: true },
  });
  if (!revision) return false;

  // Merge only the admin/live fields into the existing snapshot JSON, leaving
  // all pricing/package/customer/TOP data untouched. Note Date Event (notes) is a
  // free-text field that never triggers a material change, so — like signingLocation —
  // it stays fresh in an already-signed snapshot.
  const existingSnap = (revision.snapshotData ?? {}) as Record<string, unknown>;
  const patched: Record<string, unknown> = {
    ...existingSnap,
    signingLocation: booking.signingLocation ?? null,
    notes: booking.notes ?? null,
  };

  await db.bookingRevision.update({
    where: { id: booking.currentRevisionId },
    data: { snapshotData: patched as Prisma.InputJsonValue },
  });

  return true;
}
