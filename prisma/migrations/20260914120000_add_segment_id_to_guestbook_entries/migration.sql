-- Add optional segmentId to guestbook_entries, backed by lead_segments (DailyActivitySegment).
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "segmentId" TEXT;

DROP INDEX IF EXISTS "guestbook_entries_segmentId_idx";
CREATE INDEX "guestbook_entries_segmentId_idx" ON "guestbook_entries"("segmentId");

ALTER TABLE "guestbook_entries" DROP CONSTRAINT IF EXISTS "guestbook_entries_segmentId_fkey";
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "lead_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
