-- CreateTable: banners
-- Dashboard landing carousel banners — replaces hardcoded BANNERS array in
-- dashboard-banner-carousel.tsx. imageKey stores the storage KEY (avatar
-- convention), resolved to a public URL at read time via getPublicUrl().
CREATE TABLE IF NOT EXISTS "banners" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "title"     TEXT         NOT NULL,
  "caption"   TEXT,
  "imageKey"  TEXT         NOT NULL,
  "linkUrl"   TEXT,
  "sortOrder" INTEGER      NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN      NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);
