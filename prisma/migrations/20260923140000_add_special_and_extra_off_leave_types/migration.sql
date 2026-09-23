-- Add system leave types shown in the leave request dropdown.
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
VALUES
  (
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
  ),
  (
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
  )
ON CONFLICT (code) DO NOTHING;
