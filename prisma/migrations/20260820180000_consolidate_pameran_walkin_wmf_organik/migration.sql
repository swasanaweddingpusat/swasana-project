-- Consolidate remaining messy/duplicate SourceOfInformation rows into their
-- intended canonical buckets, same pattern used for the "Referral" family:
-- before repointing a booking's sourceOfInformationId, preserve the
-- duplicate row's original name into bookings.sourceOfInformationDetail
-- (only when that column is still empty) so specific event/channel info
-- isn't lost, then repoint FKs and delete the now-orphaned rows.
--
-- Groupings below are curated manually (not pattern-matched) — these are
-- distinct exhibition/channel names, not simple typos of one word:
--   Bitrix              <- "BITR" (0 usage, orphan the earlier bitrix-family
--                           migration's ILIKE '%bitrix%' pattern didn't catch)
--   Event/Pameran        <- "DATA PAMERAN GWE", "PAMERAN GWE JULI 2026",
--                           "Pameran NikahFest", "Pameran SWE", "pameran",
--                           "PAMER", "Pameran Wedding Market"
--   Walk-in              <- "Walkin"
--   Wedding Market Fair  <- "Iklan Wedding Market Fair",
--                           "Fresh client WMF 2026", "Pameran Wedding Market Fair"
--   Organik              <- renamed from "WA Organik" (no other rows fold
--                           in; original name preserved as detail on its
--                           bookings)
--
-- Idempotent: re-running finds no remaining source rows to merge.
DO $$
DECLARE
  bitrix_id TEXT;
  pameran_id TEXT;
  walkin_id TEXT;
  wmf_id TEXT;
  organik_id TEXT;
BEGIN
  SELECT id INTO bitrix_id FROM "source_of_informations" WHERE name = 'Bitrix' LIMIT 1;
  SELECT id INTO pameran_id FROM "source_of_informations" WHERE name = 'Event/Pameran' LIMIT 1;
  SELECT id INTO walkin_id FROM "source_of_informations" WHERE name = 'Walk-in' LIMIT 1;
  SELECT id INTO wmf_id FROM "source_of_informations" WHERE name = 'Wedding Market Fair' LIMIT 1;

  -- Bitrix: drop the "BITR" orphan (0 usage anywhere, nothing to repoint)
  IF bitrix_id IS NOT NULL THEN
    DELETE FROM "source_of_informations" WHERE name = 'BITR' AND id != bitrix_id;
  END IF;

  -- Event/Pameran family
  IF pameran_id IS NOT NULL THEN
    UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
    FROM "source_of_informations" s
    WHERE b."sourceOfInformationId" = s.id
      AND s.id != pameran_id
      AND s.name IN ('DATA PAMERAN GWE', 'PAMERAN GWE JULI 2026', 'Pameran NikahFest', 'Pameran SWE', 'pameran', 'Pameran Wedding Market')
      AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

    UPDATE "bookings" SET "sourceOfInformationId" = pameran_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('DATA PAMERAN GWE', 'PAMERAN GWE JULI 2026', 'Pameran NikahFest', 'Pameran SWE', 'pameran', 'PAMER', 'Pameran Wedding Market')
        AND id != pameran_id
    );

    UPDATE "customers" SET "sourceOfInformationId" = pameran_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('DATA PAMERAN GWE', 'PAMERAN GWE JULI 2026', 'Pameran NikahFest', 'Pameran SWE', 'pameran', 'PAMER', 'Pameran Wedding Market')
        AND id != pameran_id
    );

    UPDATE "leads" SET "sourceOfInformationId" = pameran_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('DATA PAMERAN GWE', 'PAMERAN GWE JULI 2026', 'Pameran NikahFest', 'Pameran SWE', 'pameran', 'PAMER', 'Pameran Wedding Market')
        AND id != pameran_id
    );

    DELETE FROM "source_of_informations"
    WHERE name IN ('DATA PAMERAN GWE', 'PAMERAN GWE JULI 2026', 'Pameran NikahFest', 'Pameran SWE', 'pameran', 'PAMER', 'Pameran Wedding Market')
      AND id != pameran_id;
  END IF;

  -- Walk-in family
  IF walkin_id IS NOT NULL THEN
    UPDATE "bookings" SET "sourceOfInformationId" = walkin_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations" WHERE name = 'Walkin' AND id != walkin_id
    );
    UPDATE "customers" SET "sourceOfInformationId" = walkin_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations" WHERE name = 'Walkin' AND id != walkin_id
    );
    UPDATE "leads" SET "sourceOfInformationId" = walkin_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations" WHERE name = 'Walkin' AND id != walkin_id
    );
    DELETE FROM "source_of_informations" WHERE name = 'Walkin' AND id != walkin_id;
  END IF;

  -- Wedding Market Fair family
  IF wmf_id IS NOT NULL THEN
    UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
    FROM "source_of_informations" s
    WHERE b."sourceOfInformationId" = s.id
      AND s.id != wmf_id
      AND s.name IN ('Iklan Wedding Market Fair', 'Fresh client WMF 2026', 'Pameran Wedding Market Fair')
      AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

    UPDATE "bookings" SET "sourceOfInformationId" = wmf_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Iklan Wedding Market Fair', 'Fresh client WMF 2026', 'Pameran Wedding Market Fair')
        AND id != wmf_id
    );

    UPDATE "customers" SET "sourceOfInformationId" = wmf_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Iklan Wedding Market Fair', 'Fresh client WMF 2026', 'Pameran Wedding Market Fair')
        AND id != wmf_id
    );

    UPDATE "leads" SET "sourceOfInformationId" = wmf_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Iklan Wedding Market Fair', 'Fresh client WMF 2026', 'Pameran Wedding Market Fair')
        AND id != wmf_id
    );

    DELETE FROM "source_of_informations"
    WHERE name IN ('Iklan Wedding Market Fair', 'Fresh client WMF 2026', 'Pameran Wedding Market Fair')
      AND id != wmf_id;
  END IF;

  -- Organik: rename "WA Organik" -> "Organik", preserve old name as detail
  SELECT id INTO organik_id FROM "source_of_informations" WHERE name = 'WA Organik' LIMIT 1;
  IF organik_id IS NOT NULL THEN
    UPDATE "bookings"
    SET "sourceOfInformationDetail" = 'WA Organik'
    WHERE "sourceOfInformationId" = organik_id
      AND ("sourceOfInformationDetail" IS NULL OR TRIM("sourceOfInformationDetail") = '');

    UPDATE "source_of_informations" SET name = 'Organik' WHERE id = organik_id;
  END IF;
END $$;
