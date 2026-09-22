-- AlterTable
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "attendanceConfirmedAt" TIMESTAMP(3);
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "attendanceConfirmedById" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_attendanceConfirmedById_fkey"
    FOREIGN KEY ("attendanceConfirmedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
