import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getBonuses() {
  "use cache";
  cacheTag("bonuses");
  cacheLife("minutes");

  return db.bonus.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type BonusesResult = Awaited<ReturnType<typeof getBonuses>>;
export type BonusItem = BonusesResult[number];
