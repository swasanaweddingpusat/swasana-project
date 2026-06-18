-- Sync the employeeNumber sequence with existing data.
--
-- Background: prior data-migration seeders insert profiles with an explicit
-- "employeeNumber" (copied from the source DB), bypassing nextval() on
-- "profiles_employeeNumber_seq". The sequence therefore lagged far behind the
-- max value already present, so every inviteUser hit P2002
-- (Unique constraint failed on "employeeNumber") until the sequence caught up.
--
-- This sets the sequence so the next nextval() returns MAX + 1. Idempotent:
-- safe to run whether or not the sequence is already in sync (setval is
-- absolute, not relative).
--
-- is_called = false → the given value is returned as-is by the next nextval(),
-- so we pass MAX + 1 directly. COALESCE(..., 0) + 1 handles an empty table by
-- yielding 1 (avoids setval to 0, which is below the sequence MINVALUE).

SELECT setval(
  '"profiles_employeeNumber_seq"',
  COALESCE((SELECT MAX("employeeNumber") FROM "profiles"), 0) + 1,
  false
);
