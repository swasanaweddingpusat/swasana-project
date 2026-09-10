-- Guestbook: switch photo/proof fields from raw URL strings to JSONB file
-- descriptors { id, name_file_origin, mimetype, path } — path is a storage
-- KEY (e.g. "guestbook/abc123def456.webp"), never a full URL.
--
-- NOTE: this schema has no field-level @map — columns are the Prisma field
-- names verbatim (camelCase, quoted), matching every other migration in this
-- model (see 20260812100000_add_photo_fields_to_guestbook,
-- 20260910020000_guestbook_drop_dead_fields).

-- AddColumn
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "visitorPhoto" JSONB;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofFiles" JSONB;

-- Backfill: preserve existing string URLs/keys as the descriptor's "path".
-- resolveAvatarUrl() on read handles both a relative key and a legacy full URL.
UPDATE "guestbook_entries"
SET "visitorPhoto" = jsonb_build_object(
  'id', NULL,
  'name_file_origin', NULL,
  'mimetype', 'image/webp',
  'path', "visitorPhotoUrl"
)
WHERE "visitorPhoto" IS NULL AND "visitorPhotoUrl" IS NOT NULL;

UPDATE "guestbook_entries"
SET "proofFiles" = jsonb_strip_nulls(jsonb_build_object(
  'photo', CASE WHEN "proofPhotoUrl" IS NOT NULL THEN jsonb_build_object(
    'id', NULL, 'name_file_origin', NULL, 'mimetype', 'image/webp', 'path', "proofPhotoUrl"
  ) END,
  'chat', CASE WHEN "proofChatUrl" IS NOT NULL THEN jsonb_build_object(
    'id', NULL, 'name_file_origin', NULL, 'mimetype', 'image/webp', 'path', "proofChatUrl"
  ) END,
  'lost', CASE WHEN "proofLostUrl" IS NOT NULL THEN jsonb_build_object(
    'id', NULL, 'name_file_origin', NULL, 'mimetype', 'image/webp', 'path', "proofLostUrl"
  ) END,
  'reschedule', CASE WHEN "proofRescheduleUrl" IS NOT NULL THEN jsonb_build_object(
    'id', NULL, 'name_file_origin', NULL, 'mimetype', 'image/webp', 'path', "proofRescheduleUrl"
  ) END
))
WHERE "proofFiles" IS NULL
  AND (
    "proofPhotoUrl" IS NOT NULL
    OR "proofChatUrl" IS NOT NULL
    OR "proofLostUrl" IS NOT NULL
    OR "proofRescheduleUrl" IS NOT NULL
  );

-- DropColumn: old string URL columns, superseded by the JSONB descriptors above.
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "visitorPhotoUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofChatUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofPhotoUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofLostUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofRescheduleUrl";
