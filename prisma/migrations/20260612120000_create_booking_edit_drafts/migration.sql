-- Create booking_edit_drafts (idempotent)
CREATE TABLE IF NOT EXISTS "booking_edit_drafts" (
  "id"              TEXT NOT NULL,
  "bookingId"       TEXT NOT NULL,
  "editorProfileId" TEXT NOT NULL,
  "formState"       JSONB NOT NULL,
  "pendingUploads"  JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "booking_edit_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_edit_drafts_bookingId_key" ON "booking_edit_drafts"("bookingId");
CREATE INDEX IF NOT EXISTS "booking_edit_drafts_editorProfileId_idx" ON "booking_edit_drafts"("editorProfileId");

ALTER TABLE "booking_edit_drafts" DROP CONSTRAINT IF EXISTS "booking_edit_drafts_bookingId_fkey";
ALTER TABLE "booking_edit_drafts" ADD CONSTRAINT "booking_edit_drafts_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_edit_drafts" DROP CONSTRAINT IF EXISTS "booking_edit_drafts_editorProfileId_fkey";
ALTER TABLE "booking_edit_drafts" ADD CONSTRAINT "booking_edit_drafts_editorProfileId_fkey"
  FOREIGN KEY ("editorProfileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
