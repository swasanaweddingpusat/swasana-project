-- AlterTable
ALTER TABLE "booking_comments" ADD COLUMN     "attachments" JSONB NOT NULL DEFAULT '[]';
