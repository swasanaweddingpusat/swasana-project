-- Add pdfTemplate to client_agreements: lets staff switch which PO template
-- (V1 "PO Digital" / V2 "Kediaman") the public client-agreement link renders,
-- independent of token/accessCode/status/signedAt.

-- CreateEnum: AgreementPdfTemplate (idempotent)
DO $$ BEGIN
  CREATE TYPE "AgreementPdfTemplate" AS ENUM ('V1', 'V2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "client_agreements"
  ADD COLUMN IF NOT EXISTS "pdfTemplate" "AgreementPdfTemplate" NOT NULL DEFAULT 'V1';
