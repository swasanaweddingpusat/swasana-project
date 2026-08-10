import { db } from "@/lib/db";

const packageInclude = {
  venue: { select: { id: true, name: true, address: true, brandId: true } },
  vendorItems: { orderBy: { sortOrder: "asc" as const } },
  internalItems: { orderBy: { sortOrder: "asc" as const } },
  miceItems: { orderBy: { sortOrder: "asc" as const } },
  categoryPrices: { orderBy: { sortOrder: "asc" as const } },
} as const;

export interface GetPackagesParams {
  venueId?: string;
  page?: number;
  limit?: number;
  search?: string;
  category?: "WEDDINGS" | "MICE";
}

export async function getPackages({
  venueId,
  page = 1,
  limit = 10,
  search,
  category = "WEDDINGS",
}: GetPackagesParams = {}) {
  const where = {
    category,
    ...(venueId ? { venueId } : {}),
    ...(search
      ? {
          OR: [
            { packageName: { contains: search, mode: "insensitive" as const } },
            { venue: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
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

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPackagesForBooking(venueId?: string, category: "WEDDINGS" | "MICE" = "WEDDINGS") {
  const packages = await db.package.findMany({
    where: {
      category,
      available: true,
      approvalStatus: "approved",
      ...(venueId ? { venueId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: packageInclude,
  });

  // Filter: only packages with at least 1 category price with total > 0
  return packages.filter((pkg) =>
    (pkg.categoryPrices ?? []).reduce((sum, c) => sum + Number(c.basePrice), 0) > 0
  );
}

/**
 * MICE packages consumable by the quotation drawer. Deliberately NOT reusing
 * getPackagesForBooking: that filters on Σ categoryPrices.basePrice > 0, but MICE
 * packages carry their price on miceItems.itemPrice (categoryPrices is often empty),
 * so valid MICE packages would be filtered out. Here we filter on having miceItems
 * instead, and only include the minimal shape the quotation explode needs.
 */
export async function getMicePackagesForQuotation(venueId?: string) {
  const packages = await db.package.findMany({
    where: {
      category: "MICE",
      available: true,
      approvalStatus: "approved",
      ...(venueId ? { venueId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      venue: { select: { id: true, name: true } },
      miceItems: { orderBy: { sortOrder: "asc" as const } },
    },
  });

  return packages.filter((pkg) => (pkg.miceItems ?? []).length > 0);
}

export type MicePackageForQuotationItem = Awaited<
  ReturnType<typeof getMicePackagesForQuotation>
>[number];

export async function getApprovalRecord(module: string, entityId: string) {
  return db.approvalRecord.findUnique({
    where: { module_entityId: { module, entityId } },
    include: {
      steps: {
        orderBy: [{ createdAt: "asc" }, { stepOrder: "asc" }],
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

export type PackageForBookingItem = Awaited<ReturnType<typeof getPackagesForBooking>>[number];
