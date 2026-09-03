DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BannerLocation') THEN
    CREATE TYPE "BannerLocation" AS ENUM ('login', 'dashboard');
  END IF;
END $$;

ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "location" "BannerLocation" NOT NULL DEFAULT 'dashboard';

CREATE INDEX IF NOT EXISTS "banners_location_isActive_sortOrder_idx" ON "banners" ("location", "isActive", "sortOrder");
