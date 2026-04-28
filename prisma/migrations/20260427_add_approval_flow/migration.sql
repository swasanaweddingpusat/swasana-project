-- CreateTable
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_steps" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverRoleId" TEXT,
    "approverUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_flows_module_key" ON "approval_flows"("module");

-- CreateIndex
CREATE INDEX "approval_flow_steps_flowId_idx" ON "approval_flow_steps"("flowId");

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_approverRoleId_fkey" FOREIGN KEY ("approverRoleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
