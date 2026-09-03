-- AlterTable: banners — add file metadata columns (original filename, storage
-- filename, mime type) captured at upload time, alongside the existing
-- imageKey (storage path).
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "originalName" TEXT;
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
