import { prisma } from "./_client";

export async function seedOrderStatuses() {
  const orderStatuses = [
    { name: "Belum Diorder", sortOrder: 0 },
    { name: "Sudah Diajukan", sortOrder: 1 },
    { name: "Sudah Diorder", sortOrder: 2 },
    { name: "Sudah Dibayar", sortOrder: 3 },
  ];

  for (const s of orderStatuses) {
    const existing = await prisma.orderStatus.findUnique({ where: { name: s.name } });
    if (!existing) await prisma.orderStatus.create({ data: s });
  }

  console.log(`✅ ${orderStatuses.length} Order Statuses seeded`);
}

// Run standalone
if (process.argv[1].includes("order-statuses")) {
  seedOrderStatuses()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
