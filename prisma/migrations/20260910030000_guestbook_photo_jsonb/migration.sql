-- Guestbook: photo/proof storage switch.
-- - visitorPhoto → standalone TEXT column holding the 12-char file id; the
--   MinIO object lives at guestbook/{id}.webp.
-- - proofFiles → JSONB map of descriptors { id, name_file_origin, mimetype, path }
--   where id is the 12-char file id and path is the storage KEY.
--
-- NOTE: this schema has no field-level @map — columns are the Prisma field
-- names verbatim (camelCase, quoted), matching every other migration in this
-- model (see 20260812100000_add_photo_fields_to_guestbook,
-- 20260910020000_guestbook_drop_dead_fields).

-- AddColumn
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "visitorPhoto" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofFiles" JSONB;

-- Backfill visitorPhoto: extract the 12-char id from the legacy key/URL.
UPDATE "guestbook_entries"
SET "visitorPhoto" = regexp_replace(
  regexp_replace("visitorPhotoUrl", '^.*/', ''),
  '\.(webp|jpe?g|png)$', ''
)
WHERE "visitorPhoto" IS NULL AND "visitorPhotoUrl" IS NOT NULL;

-- Backfill proofFiles: preserve existing string keys/URLs as the descriptor's
-- "path"; "id" is derived by stripping the folder prefix and extension.
UPDATE "guestbook_entries"
SET "proofFiles" = jsonb_strip_nulls(jsonb_build_object(
  'photo', CASE WHEN "proofPhotoUrl" IS NOT NULL THEN jsonb_build_object(
    'id', regexp_replace(regexp_replace("proofPhotoUrl", '^.*/', ''), '\.(webp|jpe?g|png)$', ''),
    'name_file_origin', NULL,
    'mimetype', 'image/webp',
    'path', "proofPhotoUrl"
  ) END,
  'chat', CASE WHEN "proofChatUrl" IS NOT NULL THEN jsonb_build_object(
    'id', regexp_replace(regexp_replace("proofChatUrl", '^.*/', ''), '\.(webp|jpe?g|png)$', ''),
    'name_file_origin', NULL,
    'mimetype', 'image/webp',
    'path', "proofChatUrl"
  ) END,
  'lost', CASE WHEN "proofLostUrl" IS NOT NULL THEN jsonb_build_object(
    'id', regexp_replace(regexp_replace("proofLostUrl", '^.*/', ''), '\.(webp|jpe?g|png)$', ''),
    'name_file_origin', NULL,
    'mimetype', 'image/webp',
    'path', "proofLostUrl"
  ) END,
  'reschedule', CASE WHEN "proofRescheduleUrl" IS NOT NULL THEN jsonb_build_object(
    'id', regexp_replace(regexp_replace("proofRescheduleUrl", '^.*/', ''), '\.(webp|jpe?g|png)$', ''),
    'name_file_origin', NULL,
    'mimetype', 'image/webp',
    'path', "proofRescheduleUrl"
  ) END
))
WHERE "proofFiles" IS NULL
  AND (
    "proofPhotoUrl" IS NOT NULL
    OR "proofChatUrl" IS NOT NULL
    OR "proofLostUrl" IS NOT NULL
    OR "proofRescheduleUrl" IS NOT NULL
  );

-- DropColumn: old string URL columns, superseded by the fields above.
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "visitorPhotoUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofChatUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofPhotoUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofLostUrl";
ALTER TABLE "guestbook_entries" DROP COLUMN IF EXISTS "proofRescheduleUrl";
