-- AlterTable
ALTER TABLE "approval_flow_configs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "approval_flow_steps" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "commentId" TEXT,
ADD COLUMN IF NOT EXISTS "isMention" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_isMention_isRead_idx" ON "notifications"("userId", "isMention", "isRead");
