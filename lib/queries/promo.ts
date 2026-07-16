import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getPromoPrograms() {
  "use cache";
  cacheTag("promos");
  cacheLife("minutes");

  return db.discountProgram.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      discountType: true,
      discountValue: true,
      type: true,
      minTransaction: true,
      periodStart: true,
      periodEnd: true,
      eventEligibleStart: true,
      eventEligibleEnd: true,
      quota: true,
      usedCount: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type PromoProgramsResult = Awaited<ReturnType<typeof getPromoPrograms>>;
export type PromoProgramItem = PromoProgramsResult[number];
