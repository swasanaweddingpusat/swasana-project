-- CreateEnum
CREATE TYPE "GuestbookSource" AS ENUM ('database', 'walk_in', 'referral');

-- AlterTable: Add new columns to guestbook_entries
ALTER TABLE "guestbook_entries" ADD COLUMN "source" "GuestbookSource";
ALTER TABLE "guestbook_entries" ADD COLUMN "proofChatUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN "proofPhotoUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN "proofLostUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN "proofRescheduleUrl" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN "commitVisitDate" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN "commitPayDate" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN "bitrixSourceInfo" TEXT;

-- Recreate GuestVisitStatus enum: add in_progress, pending, lost; remove not_joined
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
