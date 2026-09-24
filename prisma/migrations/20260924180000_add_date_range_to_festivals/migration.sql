-- Festival date range (used by the Guestbook "Tambah Festival" quick-create dialog)
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "festivals" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
