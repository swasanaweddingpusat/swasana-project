-- CreateEnum: announcement_priority
DO $$ BEGIN
  CREATE TYPE "announcement_priority" AS ENUM ('high', 'normal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: announcement_status
DO $$ BEGIN
  CREATE TYPE "announcement_status" AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: announcements
CREATE TABLE IF NOT EXISTS "announcements" (
  "id"             TEXT                   NOT NULL DEFAULT gen_random_uuid(),
  "title"          TEXT                   NOT NULL,
  "category"       TEXT,
  "content"        TEXT,
  "priority"       "announcement_priority" NOT NULL DEFAULT 'normal',
  "targetAudience" TEXT,
  "status"         "announcement_status"  NOT NULL DEFAULT 'draft',
  "publishedAt"    TIMESTAMP(3),
  "venueId"        TEXT,
  "createdById"    TEXT                   NOT NULL,
  "createdAt"      TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)           NOT NULL,

  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: announcement_comments
CREATE TABLE IF NOT EXISTS "announcement_comments" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "announcementId" TEXT         NOT NULL,
  "authorId"       TEXT         NOT NULL,
  "content"        TEXT         NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "announcement_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: announcement_readers
CREATE TABLE IF NOT EXISTS "announcement_readers" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "announcementId" TEXT         NOT NULL,
  "readerId"       TEXT         NOT NULL,
  "seenAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "announcement_readers_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
DROP INDEX IF EXISTS "announcement_readers_announcementId_readerId_key";
ALTER TABLE "announcement_readers" ADD CONSTRAINT "announcement_readers_announcementId_readerId_key" UNIQUE ("announcementId", "readerId");

-- Indexes
CREATE INDEX IF NOT EXISTS "announcements_createdById_idx" ON "announcements"("createdById");
CREATE INDEX IF NOT EXISTS "announcements_status_idx" ON "announcements"("status");

CREATE INDEX IF NOT EXISTS "announcement_comments_announcementId_idx" ON "announcement_comments"("announcementId");
CREATE INDEX IF NOT EXISTS "announcement_comments_authorId_idx" ON "announcement_comments"("authorId");

CREATE INDEX IF NOT EXISTS "announcement_readers_announcementId_idx" ON "announcement_readers"("announcementId");
CREATE INDEX IF NOT EXISTS "announcement_readers_readerId_idx" ON "announcement_readers"("readerId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcements" ADD CONSTRAINT "announcements_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_comments" ADD CONSTRAINT "announcement_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_readers" ADD CONSTRAINT "announcement_readers_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "announcement_readers" ADD CONSTRAINT "announcement_readers_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
