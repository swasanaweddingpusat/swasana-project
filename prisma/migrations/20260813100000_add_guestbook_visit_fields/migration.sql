-- CreateEnum
CREATE TYPE "GuestVisitStatus" AS ENUM ('deal', 'to_be_discuss', 'not_joined');

-- AlterTable
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "guestCode" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "visitStatus" "GuestVisitStatus";
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "notJoinReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "guestbook_entries_guestCode_key" ON "guestbook_entries"("guestCode");
