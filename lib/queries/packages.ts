import { db } from "@/lib/db";

const packageInclude = {
  venue: { select: { id: true, name: true, address: true, brandId: true } },
  variants: {
    orderBy: { pax: "asc" as const },
    include: {
      vendorItems: true,
      internalItems: true,
      package_variant_category_prices: true,
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

export async function getPackageById(id: string) {
  return db.package.findUnique({
    where: { id },
    include: packageInclude,
  });
}

export type PackagesQueryResult = Awaited<ReturnType<typeof getPackages>>;
export type PackageQueryItem = PackagesQueryResult[number];
