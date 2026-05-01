import { prisma } from "./_client";

export async function seedEventTypes() {
  const types = [
    { name: "Resepsi", code: "R", sortOrder: 1 },
    { name: "Akad & Resepsi", code: "AR", sortOrder: 2 },
    { name: "Teapai & Resepsi", code: "TR", sortOrder: 3 },
    { name: "Pemberkatan Resepsi", code: "PR", sortOrder: 4 },
    { name: "Venue Only", code: "VO", sortOrder: 5 },
  ];

  for (const data of types) {
    const existing = await prisma.eventType.findUnique({ where: { code: data.code } });
    if (!existing) await prisma.eventType.create({ data });
  }
  console.log(`✅ ${types.length} Event Types seeded`);
}

// Run standalone
if (process.argv[1].includes("event-types")) {
  seedEventTypes()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
