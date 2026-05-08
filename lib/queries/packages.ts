import { db } from "@/lib/db";

const packageInclude = {
  venue: { select: { id: true, name: true, address: true, brandId: true } },
  variants: {
    orderBy: { pax: "asc" as const },
    include: {
      vendorItems: true,
      internalItems: true,
      categoryPrices: { orderBy: { sortOrder: "asc" as const } },
    },
  },
} as const;

export async function getPackages(venueId?: string, page = 1, limit = 10) {
  const where = venueId ? { venueId } : undefined;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.package.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: packageInclude,
    }),
    db.package.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getPackagesForBooking(venueId?: string) {
  const packages = await db.package.findMany({
    where: {
      available: true,
      approvalStatus: "approved",
      ...(venueId ? { venueId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      ...packageInclude,
      variants: {
        ...packageInclude.variants,
        where: { available: true },
      },
    },
  });

  // Filter: only packages with at least 1 variant that has total price > 0
  return packages.filter((pkg) =>
    pkg.variants.some((v) =>
      (v.categoryPrices ?? []).reduce((sum, c) => sum + Number(c.basePrice), 0) > 0
    )
  );
}

export async function getApprovalRecord(module: string, entityId: string) {
  return db.approvalRecord.findUnique({
    where: { module_entityId: { module, entityId } },
    include: {
      steps: {
        orderBy: { stepOrder: "asc" },
        include: {
          approverRole: { select: { id: true, name: true } },
          approverUser: { select: { id: true, fullName: true } },
          decidedBy: { select: { id: true, fullName: true } },
        },
      },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
}

export async function getApprovalRecordsByModule(module: string, page = 1, limit = 10) {
  const where = { module };
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.approvalRecord.findMany({
      where,
      skip,
      take: limit,
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
          include: {
            approverRole: { select: { id: true, name: true } },
            approverUser: { select: { id: true, fullName: true } },
            decidedBy: { select: { id: true, fullName: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
    db.approvalRecord.count({ where }),
  ]);

  return { data, total, page, limit };
}

export type ApprovalRecordWithSteps = NonNullable<Awaited<ReturnType<typeof getApprovalRecord>>>;

export async function getPackageById(id: string) {
  return db.package.findUnique({
    where: { id },
    include: packageInclude,
  });
}

export type PackagesQueryResult = Awaited<ReturnType<typeof getPackages>>;
export type PackageQueryItem = PackagesQueryResult["data"][number];
