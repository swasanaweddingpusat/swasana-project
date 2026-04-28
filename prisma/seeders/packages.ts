import { prisma } from "./_client";

export async function seedPackages() {
  // Cleanup orphan approval records for packages and bookings
  const packageIds = (await prisma.package.findMany({ select: { id: true } })).map((p) => p.id);
  const bookingIds = (await prisma.booking.findMany({ select: { id: true } })).map((b) => b.id);

  await prisma.approvalRecord.deleteMany({
    where: {
      OR: [
        { module: "package", entityId: { notIn: packageIds } },
        { module: "booking", entityId: { notIn: bookingIds } },
      ],
    },
  });

  // Delete all bookings (cascade: snap*, etc.)
  await prisma.booking.deleteMany({});
  console.log("🗑️  All bookings deleted");

  // Delete all packages (cascade: variants, vendorItems, internalItems)
  await prisma.package.deleteMany({});
  console.log("🗑️  All packages deleted");

  const venues = await prisma.venue.findMany({ select: { id: true, code: true, name: true } });
  const venueByCode = Object.fromEntries(venues.map((v) => [v.code, v.id]));

  // Get sales user profile for approval record creator
  const salesUser = await prisma.user.findUnique({ where: { email: "sales@swasana.com" } });
  const salesProfile = salesUser ? await prisma.profile.findUnique({ where: { userId: salesUser.id } }) : null;

  // Get approval flow for package
  const flow = await prisma.approvalFlow.findUnique({
    where: { module: "package" },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  const VARIANTS = [
    { variantName: "GOLD", pax: 800 },
    { variantName: "SAPPHIRE", pax: 800 },
    { variantName: "PLATINUM", pax: 800 },
  ];

  const packageData = venues.map((v) => ({
    packageName: `${v.name.toUpperCase()} PACKAGE`,
    venueCode: v.code,
  }));

  let count = 0;
  for (const pkg of packageData) {
    const venueId = venueByCode[pkg.venueCode];
    if (!venueId) { console.warn(`⚠️  Venue ${pkg.venueCode} not found, skipping ${pkg.packageName}`); continue; }

    const created = await prisma.package.create({
      data: { packageName: pkg.packageName, available: true, venueId, notes: "", approvalStatus: "pending" },
    });

    for (const v of VARIANTS) {
      await prisma.packageVariant.create({ data: { packageId: created.id, variantName: v.variantName, pax: v.pax, available: true } });
    }

    // Create approval record if flow exists and sales profile exists
    if (flow && flow.steps.length > 0 && salesProfile) {
      const record = await prisma.approvalRecord.create({
        data: { module: "package", entityId: created.id, status: "pending", createdById: salesProfile.id },
      });

      // Sales role auto-approves step 1, rest pending
      const salesRole = await prisma.role.findUnique({ where: { name: "sales" } });
      const salesStepIdx = flow.steps.findIndex((s) => s.approverType === "role" && s.approverRoleId === salesRole?.id);

      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        const shouldAutoApprove = salesStepIdx >= 0 && i <= salesStepIdx;
        await prisma.approvalRecordStep.create({
          data: {
            recordId: record.id, stepOrder: step.sortOrder, approverType: step.approverType,
            approverRoleId: step.approverRoleId, approverUserId: step.approverUserId,
            status: shouldAutoApprove ? "approved" : "pending",
            decidedById: shouldAutoApprove ? salesProfile.id : null,
            decidedAt: shouldAutoApprove ? new Date() : null,
          },
        });
      }
    }

    count++;
  }

  console.log(`✅ ${count} Packages seeded with GOLD/SAPPHIRE/PLATINUM variants, created by sales@swasana.com`);
}

// Run standalone
if (process.argv[1].includes("packages")) {
  seedPackages()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
