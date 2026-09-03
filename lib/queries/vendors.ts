import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

/**
 * Full category → vendor tree (with payment methods). Used as lookup/reference
 * data for vendor-picker dropdowns (booking vendor assignment, complimentary
 * bonus picker) where every vendor in a category must be selectable — not a
 * browsable listing, so pagination doesn't apply here.
 */
export async function getVendorCategories() {
  "use cache";
  cacheTag("vendors");
  cacheLife("minutes");

  return db.vendorCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      vendors: {
        orderBy: { updatedAt: "desc" },
        take: 500,
        include: { paymentMethods: true },
      },
    },
  });
}

/**
 * Lightweight category list (id, name, vendor count) — for filter dropdowns
 * that only need to label/count categories, not their full vendor payload.
 */
export async function getVendorCategoriesLite() {
  "use cache";
  cacheTag("vendors");
  cacheLife("minutes");

  const categories = await db.vendorCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, _count: { select: { vendors: true } } },
  });

  return categories.map((c) => ({ id: c.id, name: c.name, vendorCount: c._count.vendors }));
}

export type VendorCategoriesResult = Awaited<ReturnType<typeof getVendorCategories>>;
export type VendorCategoryItem = VendorCategoriesResult[number];
export type VendorCategoriesLiteResult = Awaited<ReturnType<typeof getVendorCategoriesLite>>;

/**
 * Server-driven paginated + searchable vendor listing — mirrors getCustomers.
 * Filter + pagination happen in the DB query, not in the client.
 */
export async function getVendors(page = 1, limit = 10, search = "", categoryId?: string) {
  "use cache";
  cacheTag("vendors");
  cacheLife("minutes");

  const skip = (page - 1) * limit;
  const where = {
    ...(categoryId && categoryId !== "all" ? { categoryId } : {}),
    ...(search.trim() ? { name: { contains: search.trim(), mode: "insensitive" as const } } : {}),
  };

  const [data, total] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
        paymentMethods: true,
      },
    }),
    db.vendor.count({ where }),
  ]);

  return { data, total, page, limit };
}

export type VendorsResult = Awaited<ReturnType<typeof getVendors>>;
export type VendorItem = VendorsResult["data"][number];
