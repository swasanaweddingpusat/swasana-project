-- AlterTable: add instansi column to leads (optional field)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "instansi" TEXT;
