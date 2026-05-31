-- AlterTable: add address column to leads (idempotent)
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "address" TEXT;
