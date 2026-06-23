import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";

export async function getComplimentaries() {
  "use cache";
  cacheTag("complimentaries");
  cacheLife("minutes");

  return db.complimentary.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      description: true,
      isShowPrice: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

export type ComplimentariesResult = Awaited<ReturnType<typeof getComplimentaries>>;
export type ComplimentaryItem = ComplimentariesResult[number];
