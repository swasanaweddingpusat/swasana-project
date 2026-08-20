-- Final cleanup pass: collapse remaining SourceOfInformation rows so only the
-- 7 canonical buckets survive — Bitrix, Bridestory, Event/Pameran, Referral,
-- Walk-in, Wedding Market Fair, Organik. Same pattern as the two prior
-- consolidation migrations: preserve the duplicate row's original name into
-- bookings.sourceOfInformationDetail (only when still empty) before
-- repointing FKs, then delete the now-orphaned rows.
--
-- Groupings curated manually with the user (business judgment, not
-- pattern-matched):
--   Bitrix    <- all remaining social-media / ads-adjacent channels:
--                "Database Live TikTok Sopia", "Facebook", "Google",
--                "Iklan BRIN Gatsu", "Iklan IG Slipi", "INFO PRICELIST",
--                "Instagram", "RSVP IG Samisara", "TikTok", "TikTok pribadi",
--                "Website", "WhatsApp" — user directive: any FB/IG/TikTok/etc
--                social-media source folds into Bitrix as the digital
--                catch-all so only 7 categories remain.
--   Event/Pameran <- "FRESH CLIENT BSM" (distinct venue from Wedding Market
--                Fair's earlier "Fresh client WMF 2026" — user confirmed BSM
--                is a different exhibition, not WMF)
--   Organik   <- "Data hp kantor Patrajasa", "Simpul Bahagia", "TBD"
--   Referral  <- "ref", "REFE", "REFRE": 0-usage typo droppings that the
--                earlier referral-family ILIKE pattern didn't catch (too
--                short to match '%referal%' etc) — no data to preserve.
--
-- Idempotent: re-running finds no remaining source rows to merge.
DO $$
DECLARE
  bitrix_id TEXT;
  pameran_id TEXT;
  organik_id TEXT;
  referral_id TEXT;
BEGIN
  SELECT id INTO bitrix_id FROM "source_of_informations" WHERE name = 'Bitrix' LIMIT 1;
  SELECT id INTO pameran_id FROM "source_of_informations" WHERE name = 'Event/Pameran' LIMIT 1;
  SELECT id INTO organik_id FROM "source_of_informations" WHERE name = 'Organik' LIMIT 1;
  SELECT id INTO referral_id FROM "source_of_informations" WHERE name = 'Referral' LIMIT 1;

  -- Bitrix: social-media + ads/misc digital catch-all
  IF bitrix_id IS NOT NULL THEN
    UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
    FROM "source_of_informations" s
    WHERE b."sourceOfInformationId" = s.id
      AND s.id != bitrix_id
      AND s.name IN ('Database Live TikTok Sopia', 'Facebook', 'Google', 'Iklan BRIN Gatsu', 'Iklan IG Slipi', 'INFO PRICELIST', 'Instagram', 'RSVP IG Samisara', 'TikTok', 'TikTok pribadi', 'Website', 'WhatsApp')
      AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

    UPDATE "bookings" SET "sourceOfInformationId" = bitrix_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Database Live TikTok Sopia', 'Facebook', 'Google', 'Iklan BRIN Gatsu', 'Iklan IG Slipi', 'INFO PRICELIST', 'Instagram', 'RSVP IG Samisara', 'TikTok', 'TikTok pribadi', 'Website', 'WhatsApp')
        AND id != bitrix_id
    );

    UPDATE "customers" SET "sourceOfInformationId" = bitrix_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Database Live TikTok Sopia', 'Facebook', 'Google', 'Iklan BRIN Gatsu', 'Iklan IG Slipi', 'INFO PRICELIST', 'Instagram', 'RSVP IG Samisara', 'TikTok', 'TikTok pribadi', 'Website', 'WhatsApp')
        AND id != bitrix_id
    );

    UPDATE "leads" SET "sourceOfInformationId" = bitrix_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Database Live TikTok Sopia', 'Facebook', 'Google', 'Iklan BRIN Gatsu', 'Iklan IG Slipi', 'INFO PRICELIST', 'Instagram', 'RSVP IG Samisara', 'TikTok', 'TikTok pribadi', 'Website', 'WhatsApp')
        AND id != bitrix_id
    );

    DELETE FROM "source_of_informations"
    WHERE name IN ('Database Live TikTok Sopia', 'Facebook', 'Google', 'Iklan BRIN Gatsu', 'Iklan IG Slipi', 'INFO PRICELIST', 'Instagram', 'RSVP IG Samisara', 'TikTok', 'TikTok pribadi', 'Website', 'WhatsApp')
      AND id != bitrix_id;
  END IF;

  -- Event/Pameran: FRESH CLIENT BSM
  IF pameran_id IS NOT NULL THEN
    UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
    FROM "source_of_informations" s
    WHERE b."sourceOfInformationId" = s.id
      AND s.id != pameran_id
      AND s.name = 'FRESH CLIENT BSM'
      AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

    UPDATE "bookings" SET "sourceOfInformationId" = pameran_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations" WHERE name = 'FRESH CLIENT BSM' AND id != pameran_id
    );

    DELETE FROM "source_of_informations" WHERE name = 'FRESH CLIENT BSM' AND id != pameran_id;
  END IF;

  -- Organik: Data hp kantor Patrajasa, Simpul Bahagia, TBD
  IF organik_id IS NOT NULL THEN
    UPDATE "bookings" b SET "sourceOfInformationDetail" = s.name
    FROM "source_of_informations" s
    WHERE b."sourceOfInformationId" = s.id
      AND s.id != organik_id
      AND s.name IN ('Data hp kantor Patrajasa', 'Simpul Bahagia', 'TBD')
      AND (b."sourceOfInformationDetail" IS NULL OR TRIM(b."sourceOfInformationDetail") = '');

    UPDATE "bookings" SET "sourceOfInformationId" = organik_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Data hp kantor Patrajasa', 'Simpul Bahagia', 'TBD') AND id != organik_id
    );

    UPDATE "leads" SET "sourceOfInformationId" = organik_id
    WHERE "sourceOfInformationId" IN (
      SELECT id FROM "source_of_informations"
      WHERE name IN ('Data hp kantor Patrajasa', 'Simpul Bahagia', 'TBD') AND id != organik_id
    );

    DELETE FROM "source_of_informations"
    WHERE name IN ('Data hp kantor Patrajasa', 'Simpul Bahagia', 'TBD') AND id != organik_id;
  END IF;

  -- Referral: leftover 0-usage typo rows too short for the earlier ILIKE pattern
  IF referral_id IS NOT NULL THEN
    DELETE FROM "source_of_informations" WHERE name IN ('ref', 'REFE', 'REFRE') AND id != referral_id;
  END IF;
END $$;
