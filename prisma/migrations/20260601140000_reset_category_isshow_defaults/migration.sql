-- Reset isShow on package category prices: only the 7 core categories are shown
-- (Catering, Dekorasi, Rias Busana, Photography, Entertainment, MC, WO); everything
-- else is hidden. Matched by global Category id (FK), not by fragile name string.
-- Idempotent: re-running yields the same final state.

-- 1. Hide everything first
UPDATE "package_category_prices" SET "isShow" = false;

-- 2. Show only the 7 core categories (by linked global category name)
UPDATE "package_category_prices" p
SET "isShow" = true
FROM "categories" c
WHERE p."categoryId" = c.id
  AND c."name" = ANY (ARRAY[
    'Catering', 'Dekorasi', 'Rias Busana', 'Photography', 'Entertainment', 'MC', 'WO'
  ]);
