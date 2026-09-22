import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPackageTypeCategories() {
  "use cache";
  cacheTag("package-type-category");
  cacheLife("minutes");

  return db.packageTypeCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, isActive: true, sortOrder: true, createdAt: true },
    orderBy: { sortOrder: "asc" },
    take: 500,
  });
}

export type PackageTypeCategoriesResult = Awaited<ReturnType<typeof getPackageTypeCategories>>;
export type PackageTypeCategoryItem = PackageTypeCategoriesResult[number];
