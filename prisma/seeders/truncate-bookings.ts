import { prisma } from "./_client";

export async function truncateBookings() {
  // 1. Approval records (no FK to booking — manual cleanup)
  const { count: approvalSteps } = await prisma.approvalRecordStep.deleteMany({
    where: { record: { module: "booking" } },
  });
  const { count: approvalRecords } = await prisma.approvalRecord.deleteMany({
    where: { module: "booking" },
  });
  console.error(`🗑️  Deleted ${approvalRecords} approval records, ${approvalSteps} steps`);

  // 2. Activity logs (no FK to booking — manual cleanup)
  const { count: logs } = await prisma.activityLog.deleteMany({
    where: { entityType: "booking" },
  });
  console.error(`🗑️  Deleted ${logs} activity logs`);

  // 3. Delete all bookings (CASCADE handles: revisions, snaps, ToP, documents, comments, settlements, agreements)
  const { count: bookings } = await prisma.booking.deleteMany({});
  console.error(`🗑️  Deleted ${bookings} bookings (+ all related snap/revision/ToP/docs/comments/settlements)`);

  // 4. Delete all customers (safe — bookings already deleted)
  const { count: customers } = await prisma.customer.deleteMany({});
  console.error(`🗑️  Deleted ${customers} customers`);

  // 5. Reset counters (invoice & PO numbering)
  const { count: counters } = await prisma.counter.deleteMany({});
  console.error(`🗑️  Reset ${counters} counters`);

  console.error("✅ Booking data truncated successfully");
}

// Run standalone: npx tsx prisma/seeders/truncate-bookings.ts
if (process.argv[1].includes("truncate-bookings")) {
  truncateBookings()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
