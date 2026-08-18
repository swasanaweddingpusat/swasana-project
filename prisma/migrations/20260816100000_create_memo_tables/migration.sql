-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "memo_status" AS ENUM ('draft', 'review', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: memos
CREATE TABLE IF NOT EXISTS "memos" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "noMemo"         TEXT         NOT NULL,
  "judul"          TEXT         NOT NULL,
  "perihal"        TEXT,
  "ruangLingkup"   TEXT,
  "kepada"         TEXT,
  "tembusan"       TEXT,
  "jenisInformasi" TEXT,
  "klasifikasi"    TEXT,
  "yangMenyetujui" TEXT,
  "yangMengetahui" TEXT,
  "isiMemo"        TEXT,
  "status"         "memo_status" NOT NULL DEFAULT 'draft',
  "venueId"        TEXT,
  "createdById"    TEXT         NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "memos_pkey" PRIMARY KEY ("id")
);

-- CreateTable: memo_comments
CREATE TABLE IF NOT EXISTS "memo_comments" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "memoId"    TEXT         NOT NULL,
  "authorId"  TEXT         NOT NULL,
  "content"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "memo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: memo_readers
CREATE TABLE IF NOT EXISTS "memo_readers" (
  "id"       TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "memoId"   TEXT         NOT NULL,
  "readerId" TEXT         NOT NULL,
  "seenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "memo_readers_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "memos" ADD CONSTRAINT "memos_noMemo_key" UNIQUE ("noMemo");

DROP INDEX IF EXISTS "memo_readers_memoId_readerId_key";
ALTER TABLE "memo_readers" ADD CONSTRAINT "memo_readers_memoId_readerId_key" UNIQUE ("memoId", "readerId");

-- Indexes
CREATE INDEX IF NOT EXISTS "memos_createdById_idx" ON "memos"("createdById");
CREATE INDEX IF NOT EXISTS "memos_venueId_idx" ON "memos"("venueId");
CREATE INDEX IF NOT EXISTS "memos_status_idx" ON "memos"("status");

CREATE INDEX IF NOT EXISTS "memo_comments_memoId_idx" ON "memo_comments"("memoId");
CREATE INDEX IF NOT EXISTS "memo_comments_authorId_idx" ON "memo_comments"("authorId");

CREATE INDEX IF NOT EXISTS "memo_readers_memoId_idx" ON "memo_readers"("memoId");
CREATE INDEX IF NOT EXISTS "memo_readers_readerId_idx" ON "memo_readers"("readerId");

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "memos" ADD CONSTRAINT "memos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memos" ADD CONSTRAINT "memos_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memo_comments" ADD CONSTRAINT "memo_comments_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memo_comments" ADD CONSTRAINT "memo_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memo_readers" ADD CONSTRAINT "memo_readers_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "memos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memo_readers" ADD CONSTRAINT "memo_readers_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
