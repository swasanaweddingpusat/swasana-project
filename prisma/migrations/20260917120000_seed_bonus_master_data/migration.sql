-- Seed master data bonuses (mengikuti pola idempotent WHERE NOT EXISTS di
-- 20260728230000_seed_lead_segment_master_data — "name" pada tabel "bonuses"
-- bukan unique, jadi guard per-nama dipakai supaya migration aman dijalankan berulang.

INSERT INTO "bonuses" ("id", "name", "price", "description", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.name, v.price, v.description, true, now(), now()
FROM (VALUES
    ('Cashback', 10000000, NULL::text),
    ('Voucher MUA & Attire', 5000000, NULL::text),
    ('Free Hype Stall 300 Porsi', 7000000, NULL::text),
    ('Free Photobooth Unlimited 2 Jam Resepsi', 2000000, NULL::text)
) AS v(name, price, description)
WHERE NOT EXISTS (
    SELECT 1 FROM "bonuses" b WHERE b."name" = v.name
);
