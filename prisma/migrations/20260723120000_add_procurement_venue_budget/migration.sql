-- CreateTable
CREATE TABLE IF NOT EXISTS "procurement_venue_budgets" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "budgetAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "usedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "period" TEXT NOT NULL,
    "note" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_venue_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "procurement_venue_budgets_venueId_period_key" ON "procurement_venue_budgets"("venueId", "period");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "procurement_venue_budgets_venueId_idx" ON "procurement_venue_budgets"("venueId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "procurement_venue_budgets_period_idx" ON "procurement_venue_budgets"("period");

-- AddForeignKey
ALTER TABLE "procurement_venue_budgets" ADD CONSTRAINT "procurement_venue_budgets_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_venue_budgets" ADD CONSTRAINT "procurement_venue_budgets_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
