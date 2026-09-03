import { prisma } from "./_client";

export async function seedComplimentary() {
  const items = [
    { name: "Free Corkage Fee" },
    { name: "Free GR H-1" },
    { name: "Function Room" },
    { name: "Makeup Room" },
    { name: "Smart TV" },
    { name: "Free Add Tiffany Chairs 200pcs" },
  ];

  let created = 0;
  for (const item of items) {
    const existing = await prisma.complimentary.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.complimentary.create({
        data: { name: item.name, price: 0, isShowPrice: false, isActive: true },
      });
      created++;
    }
  }

  console.log(`✅ ${created}/${items.length} Complimentary items seeded`);
}

// Run standalone
if (process.argv[1].includes("complimentary")) {
  seedComplimentary()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
