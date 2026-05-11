import { prisma } from "./_client";

async function resetAll() {
  // 1. Delete booking-related
  await prisma.approvalRecordStep.deleteMany({ where: { record: { module: "booking" } } });
  await prisma.approvalRecord.deleteMany({ where: { module: "booking" } });
  await prisma.booking.deleteMany({});
  console.log("✅ Bookings deleted");

  // 2. Delete packages + approval
  await prisma.approvalRecordStep.deleteMany({ where: { record: { module: "package" } } });
  await prisma.approvalRecord.deleteMany({ where: { module: "package" } });
  await prisma.package.deleteMany({});
  console.log("✅ Packages deleted");

  // 3. Delete venues + brands
  await prisma.paymentMethod.deleteMany({ where: { venueId: { not: null } } });
  await prisma.venue.deleteMany({});
  await prisma.brand.deleteMany({});
  console.log("✅ Venues & Brands deleted");

  console.log("\n🎉 Reset complete. Now run:");
  console.log("  npm run db:seed:brands-venues");
  console.log("  npm run db:seed:packages");
}

resetAll()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
