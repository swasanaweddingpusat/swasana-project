-- Backfill customers.bitrixId for 12 booking-linked customers whose
-- sourceOfInformation is "Bitrix" but had no bitrixId recorded.
--
-- Matches were found by looking up each customer's CPP/CPW phone number
-- against Bitrix (crm.duplicate.findbycomm -> crm.deal.list by CONTACT_ID).
-- Only "clean" matches are applied here: exactly one of the two phone
-- numbers resolved to Bitrix, and that number resolved to exactly one
-- deal. Ambiguous cases (both numbers found in Bitrix, or one number
-- matching multiple deals) were intentionally skipped and left for manual
-- review — they are NOT included in this migration.
--
-- Guarded so it never overwrites a bitrixId a user may have since set
-- manually (only fills when still empty). Idempotent: re-running finds
-- nothing left to update.
UPDATE "customers" SET "bitrixId" = '34645' WHERE id = '109dcb2d-d97f-4182-9b15-2818c8fb72a1' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '33267' WHERE id = 'ac06b784-1486-415a-a773-df9505a96faa' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '35303' WHERE id = '1f74cf03-2b9d-43f7-8978-0f814ca1b8a7' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '42221' WHERE id = '5d0a318b-57d4-47c2-bffd-377e564e895f' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '40007' WHERE id = 'e2154a27-84dd-44d3-b62e-60d50b312ddf' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '34979' WHERE id = 'fa416945-92c8-402b-ba90-1009895df9ac' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '47945' WHERE id = 'a6e2157e-7b89-459a-8070-27a1bc5c5af9' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '42361' WHERE id = '262a39d7-72e4-402f-bbe3-7c881c6684c9' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '33557' WHERE id = 'ea223c36-3744-4583-9500-d1759a91eb14' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '34447' WHERE id = '2226b16f-f25f-4fb1-a4e2-0cc80b537da4' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '18383' WHERE id = '2d6074ac-024f-48ca-8335-991e8b63f307' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
UPDATE "customers" SET "bitrixId" = '5597' WHERE id = '7371a98e-6524-4aa1-afb7-5518653ed7df' AND ("bitrixId" IS NULL OR TRIM("bitrixId") = '');
