import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getCategories() {
  "use cache";
  cacheTag("categories");
  cacheLife("hours");

  return db.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sortOrder: true },
  });
}

export type CategoriesQueryResult = Awaited<ReturnType<typeof getCategories>>;
export type CategoryQueryItem = CategoriesQueryResult[number];
