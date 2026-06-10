-- CreateTable: complimentaries (master)
CREATE TABLE IF NOT EXISTS "complimentaries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isShowPrice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complimentaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: snap_complimentaries (snapshot per booking)
CREATE TABLE IF NOT EXISTS "snap_complimentaries" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "complimentaryId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isShowPrice" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_complimentaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "complimentaries_name_key" ON "complimentaries"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snap_complimentaries_bookingId_idx" ON "snap_complimentaries"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "snap_complimentaries_complimentaryId_idx" ON "snap_complimentaries"("complimentaryId");

-- AddForeignKey
ALTER TABLE "snap_complimentaries"
    ADD CONSTRAINT "snap_complimentaries_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: nullable FK to complimentaries (SetNull on delete)
-- Use DO $$ to handle idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'snap_complimentaries_complimentaryId_fkey'
    AND table_name = 'snap_complimentaries'
  ) THEN
    ALTER TABLE "snap_complimentaries"
      ADD CONSTRAINT "snap_complimentaries_complimentaryId_fkey"
      FOREIGN KEY ("complimentaryId") REFERENCES "complimentaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
