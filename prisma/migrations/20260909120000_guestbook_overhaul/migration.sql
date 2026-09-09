-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "GuestbookSource" AS ENUM ('database', 'walk_in', 'referral');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add new columns to guestbook_entries (idempotent)
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "source" "GuestbookSource";
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofChatUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofPhotoUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofLostUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "proofRescheduleUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "commitVisitDate" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "commitPayDate" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "bitrixSourceInfo" TEXT;

-- Recreate GuestVisitStatus enum: add in_progress, pending, lost; remove not_joined (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GuestVisitStatus_new') THEN
    DROP TYPE "GuestVisitStatus_new";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'GuestVisitStatus' AND e.enumlabel = 'in_progress'
  ) THEN
    CREATE TYPE "GuestVisitStatus_new" AS ENUM ('deal', 'in_progress', 'pending', 'to_be_discuss', 'lost');

    ALTER TABLE "guestbook_entries"
      ALTER COLUMN "visitStatus" TYPE "GuestVisitStatus_new"
      USING (
        CASE
          WHEN "visitStatus" IS NULL THEN NULL
          WHEN "visitStatus"::text = 'not_joined' THEN 'lost'::"GuestVisitStatus_new"
          ELSE "visitStatus"::text::"GuestVisitStatus_new"
        END
      );

    DROP TYPE "GuestVisitStatus";
    ALTER TYPE "GuestVisitStatus_new" RENAME TO "GuestVisitStatus";
  END IF;
END $$;
