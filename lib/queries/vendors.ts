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

export async function getVendors(categoryId?: string) {
  return db.vendor.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { id: true, name: true } },
      paymentMethods: true,
    },
  });
}

export type VendorCategoriesResult = Awaited<ReturnType<typeof getVendorCategories>>;
export type VendorCategoryItem = VendorCategoriesResult[number];
export type VendorsResult = Awaited<ReturnType<typeof getVendors>>;
export type VendorItem = VendorsResult[number];
