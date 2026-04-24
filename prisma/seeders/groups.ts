import { prisma } from "./_client";

export async function seedGroups() {
  const admin = await prisma.profile.findFirst({ where: { user: { email: "admin@swasana.com" } } });

  const groupData = [
    { name: "Team Ronce Melati", sortOrder: 0 },
    { name: "Team Sedap Malam", sortOrder: 1 },
    { name: "Team Matahari", sortOrder: 2 },
    { name: "Team Anggrek", sortOrder: 3 },
    { name: "Team Mawar", sortOrder: 4 },
    { name: "Team MICE", sortOrder: 5 },
  ];

  for (const data of groupData) {
    const existing = await prisma.userGroup.findFirst({ where: { name: data.name } });
    if (!existing) {
      await prisma.userGroup.create({ data: { ...data, createdBy: admin?.id ?? null } });
    }
  }

  console.log(`✅ ${groupData.length} User Groups seeded`);
}

// Run standalone
if (process.argv[1].includes("groups")) {
  seedGroups()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
