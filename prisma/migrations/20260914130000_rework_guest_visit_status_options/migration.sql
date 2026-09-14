-- Rework GuestVisitStatus enum: drop `pending` & `in_progress`, add `cold`/`warm`/`hot`.
-- Idempotent: only runs the swap when the new `cold` value is not present yet.
-- No rows use pending/in_progress (verified), but the USING clause remaps them
-- defensively so any straggler row inserted before deploy still casts cleanly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'GuestVisitStatus' AND e.enumlabel = 'cold'
  ) THEN
    ALTER TABLE "guestbook_entries" ALTER COLUMN "visitStatus" DROP DEFAULT;
    ALTER TYPE "GuestVisitStatus" RENAME TO "GuestVisitStatus_old";
    CREATE TYPE "GuestVisitStatus" AS ENUM ('cold', 'warm', 'hot', 'to_be_discuss', 'deal', 'lost');
    ALTER TABLE "guestbook_entries"
      ALTER COLUMN "visitStatus" TYPE "GuestVisitStatus"
      USING (
        CASE "visitStatus"::text
          WHEN 'pending' THEN 'to_be_discuss'
          WHEN 'in_progress' THEN 'warm'
          ELSE "visitStatus"::text
        END::"GuestVisitStatus"
      );
    DROP TYPE "GuestVisitStatus_old";
  END IF;
END $$;
