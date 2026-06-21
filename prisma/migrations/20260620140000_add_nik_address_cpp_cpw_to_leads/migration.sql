-- Add NIK and address fields for CPP/CPW to leads table (wedding-only fields)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "nikCpp" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "nikCpw" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "addressCpp" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "addressCpw" TEXT;
