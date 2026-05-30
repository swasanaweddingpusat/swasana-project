-- AlterTable
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "isSystemRole" BOOLEAN NOT NULL DEFAULT false;

-- Seed: mark the super-admin role as system role
UPDATE "roles" SET "isSystemRole" = true WHERE "name" = 'super-admin' AND "isSystemRole" = false;
