-- CreateEnum
CREATE TYPE "DailyReportStatus" AS ENUM ('ON_TRACK', 'OFF_TRACK', 'AT_RISK');

-- AlterTable
ALTER TABLE "wedding_indicators" ALTER COLUMN "questionnaireData" SET DEFAULT '{}'::jsonb;

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "totalClientDihubungi" INTEGER NOT NULL DEFAULT 0,
    "totalHotProspect" INTEGER NOT NULL DEFAULT 0,
    "totalLeadsBaru" INTEGER NOT NULL DEFAULT 0,
    "totalFollowUp" INTEGER NOT NULL DEFAULT 0,
    "totalPotensiClosing" INTEGER NOT NULL DEFAULT 0,
    "closingHariIni" INTEGER NOT NULL DEFAULT 0,
    "actionBesok" TEXT,
    "commitVisit" TEXT,
    "actualVisit" TEXT,
    "reason" TEXT,
    "kendala" TEXT,
    "membersCompleted" JSONB NOT NULL DEFAULT '[]',
    "membersTotal" INTEGER NOT NULL DEFAULT 0,
    "status" "DailyReportStatus" NOT NULL DEFAULT 'ON_TRACK',
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_reports_groupId_idx" ON "daily_reports"("groupId");

-- CreateIndex
CREATE INDEX "daily_reports_submittedById_idx" ON "daily_reports"("submittedById");

-- CreateIndex
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_groupId_reportDate_key" ON "daily_reports"("groupId", "reportDate");

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
