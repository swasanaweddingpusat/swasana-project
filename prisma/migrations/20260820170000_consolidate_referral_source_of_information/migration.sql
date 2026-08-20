-- Consolidate every SourceOfInformation row whose name matches the
-- "referral" family (Referal/Referral/Referall/Refferal, any case/spacing —
-- e.g. "Referal Client Dea", "REFERAL KA RARA", "Referall kak Atep") into a
-- single canonical row named "Referral" (correct spelling).
--
-- Many of these duplicate rows had a referrer's name typed directly into
-- the SourceOfInformation name itself (no separate detail field existed
-- yet). Before repointing a booking's sourceOfInformationId to the
-- canonical row, this preserves the duplicate row's original name into
-- bookings.sourceOfInformationDetail (only when that column is still
-- empty) so that referrer-specific info isn't lost.
--
-- Customers/leads have no detail column — they are just repointed (0 rows
-- reference these duplicates at time of writing, so nothing to preserve
-- there either way).
--
-- Idempotent: a second run finds no remaining referral-family duplicates.
DO $$
DECLARE
  canonical_id TEXT;
BEGIN
  SELECT id INTO canonical_id FROM "source_of_informations" WHERE name = 'Referral' LIMIT 1;

  IF canonical_id IS NULL THEN
    canonical_id := gen_random_uuid()::text;
    INSERT INTO "source_of_informations" (id, name, "createdAt")
    VALUES (canonical_id, 'Referral', now());
  END IF;

  UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
  FROM "source_of_informations" s
  WHERE b."sourceOfInformationId" = s.id
    AND s.id != canonical_id
    AND (s.name ILIKE '%referal%' OR s.name ILIKE '%referral%' OR s.name ILIKE '%referall%' OR s.name ILIKE '%refferal%')
    AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

  UPDATE "bookings" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations"
    WHERE (name ILIKE '%referal%' OR name ILIKE '%referral%' OR name ILIKE '%referall%' OR name ILIKE '%refferal%')
      AND id != canonical_id
  );

  UPDATE "customers" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations"
    WHERE (name ILIKE '%referal%' OR name ILIKE '%referral%' OR name ILIKE '%referall%' OR name ILIKE '%refferal%')
      AND id != canonical_id
  );

  UPDATE "leads" SET "sourceOfInformationId" = canonical_id
  WHERE "sourceOfInformationId" IN (
    SELECT id FROM "source_of_informations"
    WHERE (name ILIKE '%referal%' OR name ILIKE '%referral%' OR name ILIKE '%referall%' OR name ILIKE '%refferal%')
      AND id != canonical_id
  );

  DELETE FROM "source_of_informations"
  WHERE (name ILIKE '%referal%' OR name ILIKE '%referral%' OR name ILIKE '%referall%' OR name ILIKE '%refferal%')
    AND id != canonical_id;
END $$;
