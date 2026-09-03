-- Re-sync the employeeNumber sequence with existing data.
--
-- Background: same class of issue as 20260618120000_sync_employee_number_sequence.
-- "profiles_employeeNumber_seq" drifted behind MAX("employeeNumber") again (a
-- data-migration seeder — see prisma/seeders/_migrate-users.ts — inserts
-- profiles with an explicit employeeNumber copied from a source DB, bypassing
-- nextval()). Every inviteUser then hit P2002 on "employeeNumber" until the
-- sequence caught up, surfaced to users as "Gagal membuat pengguna karena
-- konflik data internal."
--
-- Idempotent: safe to run whether or not the sequence is already in sync
-- (setval is absolute, not relative). is_called = false → the given value is
-- returned as-is by the next nextval(), so we pass MAX + 1 directly.
-- COALESCE(..., 0) + 1 handles an empty table by yielding 1 (avoids setval to
-- 0, which is below the sequence MINVALUE).

SELECT setval(
  '"profiles_employeeNumber_seq"',
  COALESCE((SELECT MAX("employeeNumber") FROM "profiles"), 0) + 1,
  false
);
