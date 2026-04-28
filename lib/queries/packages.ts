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

export async function getPackages(venueId?: string) {
  return db.package.findMany({
    where: venueId ? { venueId } : undefined,
    orderBy: { createdAt: "desc" },
    include: packageInclude,
  });
}

export async function getPackagesForBooking(venueId?: string) {
  return db.package.findMany({
    where: {
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

export async function getApprovalRecordsByModule(module: string) {
  return db.approvalRecord.findMany({
    where: { module },
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

export type ApprovalRecordWithSteps = NonNullable<Awaited<ReturnType<typeof getApprovalRecord>>>;

export async function getPackageById(id: string) {
  return db.package.findUnique({
    where: { id },
    include: packageInclude,
  });
}

export type PackagesQueryResult = Awaited<ReturnType<typeof getPackages>>;
export type PackageQueryItem = PackagesQueryResult[number];
