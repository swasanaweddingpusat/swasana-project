import { prisma } from "./_client";

export async function seedReferenceData() {
  const sourceNames = ["Instagram", "Facebook", "TikTok", "Google", "Referral", "Walk-in", "Website", "WhatsApp", "Event/Pameran", "Lainnya"];
  for (const name of sourceNames) {
    const existing = await prisma.sourceOfInformation.findUnique({ where: { name } });
    if (!existing) await prisma.sourceOfInformation.create({ data: { name } });
  }
  console.log(`✅ ${sourceNames.length} Source of Information seeded`);

  const educationLevels = [
    { name: "SD", order: 1 }, { name: "SMP", order: 2 }, { name: "SMA/SMK", order: 3 },
    { name: "D3", order: 4 }, { name: "S1", order: 5 }, { name: "S2", order: 6 }, { name: "S3", order: 7 },
  ];
  for (const level of educationLevels) {
    const existing = await prisma.educationLevel.findUnique({ where: { name: level.name } });
    if (!existing) await prisma.educationLevel.create({ data: level });
  }
  console.log(`✅ ${educationLevels.length} Education Levels seeded`);

  const memberStatuses = ["Non-Member", "Silver", "Gold", "Platinum"];
  for (const name of memberStatuses) {
    const existing = await prisma.customerMemberStatus.findUnique({ where: { name } });
    if (!existing) await prisma.customerMemberStatus.create({ data: { name } });
  }
  console.log(`✅ ${memberStatuses.length} Customer Member Statuses seeded`);
}

// Run standalone
if (process.argv[1].includes("reference-data")) {
  seedReferenceData()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
