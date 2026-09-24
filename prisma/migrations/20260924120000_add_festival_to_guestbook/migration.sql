-- Add Festival lookup entity and link it to guestbook_entries

CREATE TABLE IF NOT EXISTS "festivals" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "festivals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "festivals_name_key" ON "festivals"("name");

ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "festivalId" TEXT;

CREATE INDEX IF NOT EXISTS "guestbook_entries_festivalId_idx" ON "guestbook_entries"("festivalId");

DO $$ BEGIN
  ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_festivalId_fkey"
    FOREIGN KEY ("festivalId") REFERENCES "festivals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
