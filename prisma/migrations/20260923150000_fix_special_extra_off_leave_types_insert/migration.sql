-- Fixes 20260923140000_add_special_and_extra_off_leave_types, which failed in
-- production (P3009) because its INSERT only guarded against a "code" unique
-- conflict (ON CONFLICT (code) DO NOTHING) while "leave_types.name" is ALSO
-- unique. A pre-existing custom leave type sharing the name 'Spesial Cuti' or
-- 'Extra OFF' (created via the HR leave-type CRUD) collided on that column and
-- aborted the statement.
--
-- Guard on both "code" AND "name" via WHERE NOT EXISTS so this is safe to run
-- regardless of which rows already exist (idempotent, no-op if already seeded
-- by the original migration in envs where it succeeded).
INSERT INTO "leave_types" (
  id,
  name,
  code,
  description,
  "defaultQuota",
  "isDeductible",
  "requiresApproval",
  "maxConsecutiveDays",
  "minDaysBeforeRequest",
  "isCarryOver",
  "carryOverMaxDays",
  "isActive",
  "isSystemType",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Spesial Cuti',
  'special',
  'Cuti khusus sesuai kebijakan perusahaan',
  0,
  false,
  true,
  NULL,
  0,
  false,
  NULL,
  true,
  true,
  9,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "leave_types" WHERE "code" = 'special' OR "name" = 'Spesial Cuti'
);

INSERT INTO "leave_types" (
  id,
  name,
  code,
  description,
  "defaultQuota",
  "isDeductible",
  "requiresApproval",
  "maxConsecutiveDays",
  "minDaysBeforeRequest",
  "isCarryOver",
  "carryOverMaxDays",
  "isActive",
  "isSystemType",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Extra OFF',
  'extra_off',
  'Hari libur tambahan sesuai kebijakan perusahaan',
  0,
  false,
  true,
  NULL,
  0,
  false,
  NULL,
  true,
  true,
  10,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "leave_types" WHERE "code" = 'extra_off' OR "name" = 'Extra OFF'
);
