-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ProcurementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProcurementDivision" AS ENUM ('HR', 'OPERATIONAL', 'IT', 'FINANCE', 'MICE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProcurementEventType" AS ENUM ('WEDDING', 'NON_WEDDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProcurementAnnouncementTarget" AS ENUM ('ALL', 'VENUE', 'DIVISION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable procurement_items
CREATE TABLE IF NOT EXISTS "procurement_items" (
    "id" TEXT NOT NULL,
    "tanggalPermintaan" TIMESTAMP(3) NOT NULL,
    "venueId" TEXT NOT NULL,
    "namaBarang" TEXT NOT NULL,
    "jumlahBarang" INTEGER NOT NULL,
    "sisaBarang" INTEGER NOT NULL,
    "penggunaan" TEXT,
    "picPenerima" TEXT NOT NULL,
    "linkBarang" TEXT,
    "note" TEXT,
    "keterangan" TEXT,
    "keteranganAcara" "ProcurementEventType" NOT NULL DEFAULT 'WEDDING',
    "weddingNote" TEXT,
    "nonWeddingNote" TEXT,
    "totalWedding" DECIMAL(65,30),
    "totalNonWedding" DECIMAL(65,30),
    "total" DECIMAL(65,30),
    "status" "ProcurementStatus" NOT NULL DEFAULT 'PENDING',
    "division" "ProcurementDivision",
    "buktiBelUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable procurement_announcements
CREATE TABLE IF NOT EXISTS "procurement_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetAudience" "ProcurementAnnouncementTarget" NOT NULL DEFAULT 'ALL',
    "targetList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "procurement_items_venueId_idx" ON "procurement_items"("venueId");
CREATE INDEX IF NOT EXISTS "procurement_items_status_idx" ON "procurement_items"("status");
CREATE INDEX IF NOT EXISTS "procurement_items_division_idx" ON "procurement_items"("division");
CREATE INDEX IF NOT EXISTS "procurement_items_createdById_idx" ON "procurement_items"("createdById");
CREATE INDEX IF NOT EXISTS "procurement_items_approvedById_idx" ON "procurement_items"("approvedById");
CREATE INDEX IF NOT EXISTS "procurement_items_tanggalPermintaan_idx" ON "procurement_items"("tanggalPermintaan");
CREATE INDEX IF NOT EXISTS "procurement_announcements_isActive_idx" ON "procurement_announcements"("isActive");
CREATE INDEX IF NOT EXISTS "procurement_announcements_createdById_idx" ON "procurement_announcements"("createdById");

-- AddForeignKey (safe: only if not exists via IF NOT EXISTS on constraint)
DO $$ BEGIN
  ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "procurement_items" ADD CONSTRAINT "procurement_items_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "procurement_announcements" ADD CONSTRAINT "procurement_announcements_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
