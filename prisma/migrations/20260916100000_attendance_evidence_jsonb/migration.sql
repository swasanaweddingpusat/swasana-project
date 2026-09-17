-- Attendance: switch clock-in/clock-out photo fields from raw URL strings to
-- JSONB file descriptors { id, name_file_origin, mimetype, path } — path is a
-- storage KEY (e.g. "attendance/clock-in/abc123def456.webp"), never a full
-- URL. Mirrors guestbook_entries.proofFiles (see 20260910030000_guestbook_photo_jsonb).
--
-- This is a brand-new feature added earlier on this same branch with no
-- production data to preserve, so unlike the guestbook migration this is a
-- straight drop + recreate — no backfill needed.

ALTER TABLE "attendances" DROP COLUMN IF EXISTS "clockInPhotoUrl";
ALTER TABLE "attendances" DROP COLUMN IF EXISTS "clockOutPhotoUrl";

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clockInEvidence" JSONB;
ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clockOutEvidence" JSONB;
