import { db } from "@/lib/db";

export async function getVendorCategories() {
  return db.vendorCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      vendors: {
        orderBy: { updatedAt: "desc" },
        include: { paymentMethods: true },
      },
    },
  });
}

export async function getVendors(categoryId?: string, page = 1, limit = 10) {
  const where = categoryId ? { categoryId } : undefined;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: { updatedAt: "desc" },
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

export type VendorCategoriesResult = Awaited<ReturnType<typeof getVendorCategories>>;
export type VendorCategoryItem = VendorCategoriesResult[number];
export type VendorsResult = Awaited<ReturnType<typeof getVendors>>;
export type VendorItem = VendorsResult["data"][number];
