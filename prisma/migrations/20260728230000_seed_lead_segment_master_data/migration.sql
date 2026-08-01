-- Seed master data lead_segments dari daftar segment/kategori MICE.
-- Idempotent: name bukan unique, jadi pakai guard NOT EXISTS per nama —
-- aman dijalankan berulang, tidak menimbulkan duplikat.

INSERT INTO "lead_segments" ("id", "name", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid(), v.name, true, v.ord, now(), now()
FROM (VALUES
    ('Instansi', 2),
    ('Brand Beauty', 3),
    ('Automotif', 4),
    ('Institusi', 5),
    ('Coorporate', 6),
    ('Profesional Service', 7),
    ('Travel & Umroh', 8),
    ('EO', 9),
    ('Komunitas Event', 10),
    ('Tech. Company', 11),
    ('BUMN', 12),
    ('Pemerintahan', 13),
    ('Star up', 14),
    ('Lembaga/Training', 15),
    ('Kajian Keagamaan', 16),
    ('Brand F&B / Retail', 17),
    ('Perbankan', 18),
    ('Financial Company', 19),
    ('Fashion', 20),
    ('Healthcare/Wellness', 21),
    ('Pageant', 22),
    ('Competition / Comunity', 23),
    ('Transportasi', 24)
) AS v(name, ord)
WHERE NOT EXISTS (
    SELECT 1 FROM "lead_segments" ls WHERE ls."name" = v.name
);
