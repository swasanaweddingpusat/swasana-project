-- CreateTable: attendance_corrections
CREATE TABLE IF NOT EXISTS "attendance_corrections" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "requestedClockInAt" TIMESTAMP(3),
    "requestedClockOutAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'pending',
    "managerApprovedBy" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "managerNote" TEXT,
    "hrApprovedBy" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrNote" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "attendance_corrections_profileId_idx" ON "attendance_corrections"("profileId");
CREATE INDEX IF NOT EXISTS "attendance_corrections_status_idx" ON "attendance_corrections"("status");
CREATE INDEX IF NOT EXISTS "attendance_corrections_date_idx" ON "attendance_corrections"("date");

-- AddForeignKeys: attendance_corrections
DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_managerApprovedBy_fkey" FOREIGN KEY ("managerApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_hrApprovedBy_fkey" FOREIGN KEY ("hrApprovedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed permissions
INSERT INTO "permissions" (id, module, action, description, "moduleSortOrder")
VALUES
  (gen_random_uuid()::text, 'attendance-correction', 'view', 'View attendance correction requests', 24),
  (gen_random_uuid()::text, 'attendance-correction', 'create', 'Submit attendance correction requests', 24),
  (gen_random_uuid()::text, 'attendance-correction', 'edit', 'Edit attendance correction requests', 24),
  (gen_random_uuid()::text, 'attendance-correction', 'delete', 'Delete attendance correction requests', 24),
  (gen_random_uuid()::text, 'attendance-correction', 'approve', 'Approve/reject attendance correction requests (HR level)', 24)
ON CONFLICT (module, action) DO NOTHING;

-- Grant HR-level approval to the human-resource role
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT gen_random_uuid()::text, r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."module" = 'attendance-correction'
WHERE r."name" = 'human-resource'
ON CONFLICT DO NOTHING;
