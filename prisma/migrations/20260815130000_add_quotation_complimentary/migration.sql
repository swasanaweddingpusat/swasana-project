-- CreateTable: quotation_complimentaries (snapshot per quotation, mirrors snap_complimentaries)
CREATE TABLE IF NOT EXISTS "quotation_complimentaries" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "complimentaryId" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isShowPrice" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_complimentaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotation_complimentaries_quotationId_idx" ON "quotation_complimentaries"("quotationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotation_complimentaries_complimentaryId_idx" ON "quotation_complimentaries"("complimentaryId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quotation_complimentaries_quotationId_fkey'
    AND table_name = 'quotation_complimentaries'
  ) THEN
    ALTER TABLE "quotation_complimentaries"
      ADD CONSTRAINT "quotation_complimentaries_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey: nullable FK to complimentaries (SetNull on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'quotation_complimentaries_complimentaryId_fkey'
    AND table_name = 'quotation_complimentaries'
  ) THEN
    ALTER TABLE "quotation_complimentaries"
      ADD CONSTRAINT "quotation_complimentaries_complimentaryId_fkey"
      FOREIGN KEY ("complimentaryId") REFERENCES "complimentaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Grant `complimentary` permission (view/create/edit/delete) to manager-mice role.
-- manager-mice currently has quotations access but no complimentary permission at
-- all, unlike sales-mice (view/create) — needed now that quotations gain a
-- Complimentary section in the drawer. Idempotent via ON CONFLICT.
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "createdAt")
SELECT gen_random_uuid(), r."id", p."id", NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'manager-mice'
  AND p."module" = 'complimentary'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
