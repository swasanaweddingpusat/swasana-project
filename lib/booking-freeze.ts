import { db } from "@/lib/db";

/**
 * Snapshot freeze helper.
 *
 * A booking's snapshot layer freezes when the client signs the agreement
 * (`snapshotFrozenAt` is stamped in the sign route). After that point:
 *  - Internal items and vendor items stay editable (ops correcting item text/qty
 *    without re-approval) — the signed PO PDF is patched in place to match
 *    (see `patchSnapshotPackageItems` in lib/booking-revision.ts).
 *  - Complimentaries and SnapCustomer are locked; changing them requires a new
 *    revision + re-approval.
 *
 * These readers centralise the check so every snapshot-write action agrees on when
 * a booking is frozen.
 */
export async function isBookingSnapshotFrozen(bookingId: string): Promise<boolean> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { snapshotFrozenAt: true },
  });
  return booking?.snapshotFrozenAt != null;
}

/** Standard error payload for a rejected frozen-snapshot write. */
export function frozenSnapshotError(): { success: false; error: string } {
  return {
    success: false,
    error:
      "Booking sudah ditandatangani klien — data ini terkunci. Ubah lewat revisi (edit booking) agar disetujui ulang.",
  };
}
