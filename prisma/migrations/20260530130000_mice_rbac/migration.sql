-- Role: sales-mice
INSERT INTO "roles" ("id","name","description","sortOrder","isSystemRole","createdAt")
VALUES (gen_random_uuid(), 'sales-mice', 'Sales access for MICE bookings', 10, false, now())
ON CONFLICT ("name") DO NOTHING;

-- Permissions: booking-mice module (one row per action)
INSERT INTO "permissions" ("id","module","action","moduleSortOrder","createdAt")
SELECT gen_random_uuid(), 'booking-mice', a.action, 0, now()
FROM (VALUES
  ('view'),('create'),('edit'),('delete'),('print'),('approve'),
  ('mark-lost'),('restore'),('transfer'),('reject'),('comment'),('client-agreement')
) AS a(action)
ON CONFLICT ("module","action") DO NOTHING;
