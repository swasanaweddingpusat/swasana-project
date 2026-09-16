import { prisma } from "./_client";

export async function seedBonus() {
  const items = [
    { name: "Free Upgrade Kamar Pengantin", price: 1500000 },
    { name: "Free Dokumentasi Drone", price: 2000000 },
    { name: "Free Add Meja VVIP", price: 750000 },
    { name: "Free Late Check Out", price: 500000 },
    { name: "Free Welcome Drink 50pax", price: 1000000 },
  ];

  let created = 0;
  for (const item of items) {
    const existing = await prisma.bonus.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.bonus.create({
        data: { name: item.name, price: item.price, isActive: true },
      });
      created++;
    }
  }

  console.log(`✅ ${created}/${items.length} Bonus items seeded`);
}

// Run standalone
if (process.argv[1]?.includes("bonus")) {
  seedBonus()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
