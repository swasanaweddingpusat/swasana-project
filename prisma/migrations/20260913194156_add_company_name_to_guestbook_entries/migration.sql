-- Add companyName to guestbook_entries (company/institution, MICE visits only). Idempotent.
ALTER TABLE "guestbook_entries" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
