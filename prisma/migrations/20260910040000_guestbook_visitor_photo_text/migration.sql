-- Guestbook: convert visitorPhoto from JSONB descriptor to standalone TEXT id.
-- The id is the 12-char file stem; the MinIO object lives at guestbook/{id}.webp.
-- proofFiles stays JSONB (its descriptors already carry id + path).

ALTER TABLE "guestbook_entries"
  ALTER COLUMN "visitorPhoto" TYPE TEXT
  USING (
    CASE
      WHEN "visitorPhoto" IS NULL THEN NULL
      WHEN jsonb_typeof("visitorPhoto") = 'string' THEN "visitorPhoto" #>> '{}'
      WHEN ("visitorPhoto" ->> 'id') IS NOT NULL THEN "visitorPhoto" ->> 'id'
      ELSE regexp_replace(
        regexp_replace("visitorPhoto" ->> 'path', '^.*/', ''),
        '\.(webp|jpe?g|png)$', ''
      )
    END
  );
