-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "approvalStatus" TEXT NOT NULL DEFAULT 'draft';

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_record_steps" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverRoleId" TEXT,
    "approverUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_record_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_records_module_entityId_idx" ON "approval_records"("module", "entityId");

-- CreateIndex
CREATE INDEX "approval_records_createdById_idx" ON "approval_records"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "approval_records_module_entityId_key" ON "approval_records"("module", "entityId");

-- CreateIndex
CREATE INDEX "approval_record_steps_recordId_idx" ON "approval_record_steps"("recordId");

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record_steps" ADD CONSTRAINT "approval_record_steps_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "approval_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record_steps" ADD CONSTRAINT "approval_record_steps_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record_steps" ADD CONSTRAINT "approval_record_steps_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_record_steps" ADD CONSTRAINT "approval_record_steps_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
