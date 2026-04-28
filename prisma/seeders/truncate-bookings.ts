import { prisma } from "./_client";

async function truncateBookings() {
  const count = await prisma.booking.count();
  await prisma.booking.deleteMany();
  console.log(`🗑️  ${count} bookings (and all related data) deleted`);
}

truncateBookings()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
