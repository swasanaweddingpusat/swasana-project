-- Consolidate every SourceOfInformation row whose name contains "bitrix"
-- (case-insensitive) into a single canonical row named "Bitrix". Repoints
-- bookings/customers/leads referencing a duplicate row to the canonical row,
-- then removes the now-orphaned duplicates. Does NOT touch customers.bitrixId
-- (the Bitrix CRM deal id) — unrelated column, never referenced below.
-- Idempotent: a second run finds no remaining "*bitrix*" duplicates.
DO $$
DECLARE
  canonical_id TEXT;
BEGIN
  SELECT id INTO canonical_id FROM "source_of_informations" WHERE name = 'Bitrix' LIMIT 1;

  IF canonical_id IS NULL THEN
    canonical_id := gen_random_uuid()::text;
    INSERT INTO "source_of_informations" (id, name, "createdAt")
    VALUES (canonical_id, 'Bitrix', now());
  END IF;

  UPDATE "bookings" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations" WHERE name ILIKE '%bitrix%' AND id != canonical_id
  );

  UPDATE "customers" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations" WHERE name ILIKE '%bitrix%' AND id != canonical_id
  );

  UPDATE "leads" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations" WHERE name ILIKE '%bitrix%' AND id != canonical_id
  );

  DELETE FROM "source_of_informations" WHERE name ILIKE '%bitrix%' AND id != canonical_id;
END $$;
