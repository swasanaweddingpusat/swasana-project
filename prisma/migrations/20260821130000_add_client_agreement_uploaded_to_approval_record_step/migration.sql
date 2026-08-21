-- Adds a nullable JSON column to store a manually-signed PO scan reference
-- ({ path, fileName, fileType }) as an alternate way to complete the client
-- approval step, instead of the client signing digitally in-browser.
ALTER TABLE "approval_record_steps" ADD COLUMN IF NOT EXISTS "clientAgreementUploaded" JSONB;
