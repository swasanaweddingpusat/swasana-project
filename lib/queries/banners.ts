import { cacheTag, cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/storage";

export async function getBanners() {
  "use cache";
  cacheTag("banners");
  cacheLife("minutes");

  return db.banner.findMany({
    select: {
      id: true,
      title: true,
      caption: true,
      imageKey: true,
      originalName: true,
      fileName: true,
      mimeType: true,
      linkUrl: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 500,
  });
}

export type BannersResult = Awaited<ReturnType<typeof getBanners>>;
export type BannerItem = BannersResult[number];

export interface ActiveBanner {
  id: string;
  title: string;
  caption: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

export async function getActiveBanners(): Promise<ActiveBanner[]> {
  "use cache";
  cacheTag("banners");
  cacheLife("minutes");

  const banners = await db.banner.findMany({
    where: { isActive: true },
    select: { id: true, title: true, caption: true, imageKey: true, linkUrl: true },
    orderBy: { sortOrder: "asc" },
    take: 20,
  });

  return banners.map((b) => ({
    id: b.id,
    title: b.title,
    caption: b.caption,
    imageUrl: getPublicUrl(b.imageKey),
    linkUrl: b.linkUrl,
  }));
}
