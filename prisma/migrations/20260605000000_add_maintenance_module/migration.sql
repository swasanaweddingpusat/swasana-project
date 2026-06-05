-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('TICKET', 'PREVENTIVE');

-- CreateTable
CREATE TABLE "maintenance_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_priorities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deadlineDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL DEFAULT 'TICKET',
    "description" TEXT NOT NULL,
    "estimateDate" TIMESTAMP(3),
    "isVendor" BOOLEAN NOT NULL DEFAULT false,
    "isAudit" BOOLEAN NOT NULL DEFAULT false,
    "venueId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priorityId" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "frequency" TEXT,
    "nextDueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_images" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_categories_name_key" ON "maintenance_categories"("name");
CREATE UNIQUE INDEX "maintenance_priorities_name_key" ON "maintenance_priorities"("name");
CREATE UNIQUE INDEX "maintenance_statuses_name_key" ON "maintenance_statuses"("name");

CREATE INDEX "maintenance_tickets_venueId_idx" ON "maintenance_tickets"("venueId");
CREATE INDEX "maintenance_tickets_type_idx" ON "maintenance_tickets"("type");
CREATE INDEX "maintenance_tickets_statusId_idx" ON "maintenance_tickets"("statusId");
CREATE INDEX "maintenance_tickets_priorityId_idx" ON "maintenance_tickets"("priorityId");
CREATE INDEX "maintenance_tickets_assignedToId_idx" ON "maintenance_tickets"("assignedToId");
CREATE INDEX "maintenance_tickets_createdById_idx" ON "maintenance_tickets"("createdById");
CREATE INDEX "maintenance_images_ticketId_idx" ON "maintenance_images"("ticketId");

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "maintenance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "maintenance_priorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "maintenance_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_images" ADD CONSTRAINT "maintenance_images_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "maintenance_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed maintenance categories
INSERT INTO "maintenance_categories" ("id", "name", "createdAt") VALUES
  (gen_random_uuid(), 'Jaringan', NOW()),
  (gen_random_uuid(), 'Alat Elektronik', NOW()),
  (gen_random_uuid(), 'Listrik', NOW()),
  (gen_random_uuid(), 'Sipil', NOW()),
  (gen_random_uuid(), 'Air', NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed maintenance priorities
INSERT INTO "maintenance_priorities" ("id", "name", "deadlineDays", "createdAt") VALUES
  (gen_random_uuid(), 'Low', 15, NOW()),
  (gen_random_uuid(), 'Middle', 7, NOW()),
  (gen_random_uuid(), 'High', 3, NOW())
ON CONFLICT ("name") DO NOTHING;

-- Seed maintenance statuses
INSERT INTO "maintenance_statuses" ("id", "name", "order", "createdAt") VALUES
  (gen_random_uuid(), 'Create', 1, NOW()),
  (gen_random_uuid(), 'Purchase Order', 2, NOW()),
  (gen_random_uuid(), 'Assign', 3, NOW()),
  (gen_random_uuid(), 'On Progress', 4, NOW()),
  (gen_random_uuid(), 'On Checking', 5, NOW()),
  (gen_random_uuid(), 'Done', 6, NOW()),
  (gen_random_uuid(), 'Undone', 7, NOW()),
  (gen_random_uuid(), 'Complete', 8, NOW()),
  (gen_random_uuid(), 'Reject', 9, NOW()),
  (gen_random_uuid(), 'Double', 10, NOW())
ON CONFLICT ("name") DO NOTHING;
