-- AlterTable: add optional job-info fields set by HR at link-creation time
ALTER TABLE "onboarding_form_links" ADD COLUMN IF NOT EXISTS "divisi" TEXT;
ALTER TABLE "onboarding_form_links" ADD COLUMN IF NOT EXISTS "jabatan" TEXT;
ALTER TABLE "onboarding_form_links" ADD COLUMN IF NOT EXISTS "venueId" TEXT;
ALTER TABLE "onboarding_form_links" ADD COLUMN IF NOT EXISTS "joinDate" TIMESTAMP(3);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "onboarding_form_links" ADD CONSTRAINT "onboarding_form_links_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
