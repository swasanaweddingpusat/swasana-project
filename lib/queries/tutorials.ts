import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getTutorialCategories() {
  "use cache";
  cacheTag("tutorials");
  cacheLife("minutes");

  return db.tutorialCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      lessons: {
        orderBy: { sortOrder: "asc" },
        include: {
          steps: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export type TutorialCategoriesResult = Awaited<ReturnType<typeof getTutorialCategories>>;
