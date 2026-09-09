-- AlterTable: Add sourceOfInformationId and packageId to guestbook_entries
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "sourceOfInformationId" TEXT;
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "packageId" TEXT;

-- AddForeignKey
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_sourceOfInformationId_fkey" FOREIGN KEY ("sourceOfInformationId") REFERENCES "source_of_informations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "guestbook_entries_sourceOfInformationId_idx" ON "guestbook_entries"("sourceOfInformationId");
CREATE INDEX IF NOT EXISTS "guestbook_entries_packageId_idx" ON "guestbook_entries"("packageId");
