import { cacheTag, cacheLife } from "next/cache";
import { BannerLocation } from "@prisma/client";
import { db } from "@/lib/db";
import { getPublicUrl } from "@/lib/storage";

export { BannerLocation };

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
      location: true,
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

export async function getActiveBanners(location: BannerLocation): Promise<ActiveBanner[]> {
  "use cache";
  cacheTag("banners");
  cacheLife("minutes");

  // Decorative carousel, not critical path — a transient DB hiccup here (e.g.
  // during static prerender of the public login page) must not fail the whole
  // build/request. Degrade to an empty list instead of throwing.
  let banners: { id: string; title: string; caption: string | null; imageKey: string; linkUrl: string | null }[];
  try {
    banners = await db.banner.findMany({
      where: { isActive: true, location },
      select: { id: true, title: true, caption: true, imageKey: true, linkUrl: true },
      orderBy: { sortOrder: "asc" },
      take: 20,
    });
  } catch (e) {
    console.error("[getActiveBanners]", e);
    return [];
  }

  return banners.map((b) => ({
    id: b.id,
    title: b.title,
    caption: b.caption,
    imageUrl: getPublicUrl(b.imageKey),
    linkUrl: b.linkUrl,
  }));
}
