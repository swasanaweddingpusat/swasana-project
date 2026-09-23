-- Render MICE package item descriptions as real bullet lists.
--
-- package_mice_items.itemDescription is authored through SimpleEditor (TipTap) and
-- rendered with dangerouslySetInnerHTML, i.e. it is an HTML field. The seed in
-- 20260923170000 wrote plain text with "\n" separators, which HTML collapses into
-- whitespace — so multi-line inclusions like "Ballroom Facilities" rendered as one
-- long run-on paragraph instead of a list.
--
-- This rewrites those values as <ul><li>…</li></ul>, matching what the editor
-- itself produces, so both the detail modal and the edit drawer show a proper
-- bulleted list. The detail modal already styles ul/li ([&_ul]:list-disc), so no
-- component change is needed.
--
-- Only rows that are still plain text are touched (no '<' present), which also
-- makes this migration idempotent and safe against descriptions a user has since
-- edited by hand.

-- ── 1. Multi-line descriptions → <ul><li> … </li></ul> ───────────────────────
-- Each newline-separated line becomes its own list item. Empty lines are dropped
-- so a trailing "\n" cannot produce a blank bullet.
UPDATE "package_mice_items" AS i
SET "itemDescription" = sub.html,
    "updatedAt" = now()
FROM (
  SELECT
    i2."id",
    '<ul>' || string_agg('<li>' || line || '</li>', '' ORDER BY ord) || '</ul>' AS html
  FROM "package_mice_items" i2
  JOIN "packages" p ON p."id" = i2."packageId" AND p."category" = 'MICE'
  CROSS JOIN LATERAL unnest(string_to_array(i2."itemDescription", E'\n')) WITH ORDINALITY AS t(line, ord)
  WHERE i2."itemDescription" <> ''
    AND i2."itemDescription" NOT LIKE '%<%'
    AND i2."itemDescription" LIKE '%' || E'\n' || '%'
    AND btrim(line) <> ''
  GROUP BY i2."id"
) AS sub
WHERE i."id" = sub."id";

-- ── 2. Single-line descriptions → one-item list ──────────────────────────────
-- Keeps every inclusion visually consistent: Sound System / Projector & LED /
-- Seating / Food & Beverage all render as bullets alongside Ballroom Facilities.
-- "Food & Beverage" additionally uses " | " as a separator in the booklet
-- ("1x Coffee Break | 1x Buffet Meal"), which is split into separate bullets.
UPDATE "package_mice_items" AS i
SET "itemDescription" = sub.html,
    "updatedAt" = now()
FROM (
  SELECT
    i2."id",
    '<ul>' || string_agg('<li>' || btrim(part) || '</li>', '' ORDER BY ord) || '</ul>' AS html
  FROM "package_mice_items" i2
  JOIN "packages" p ON p."id" = i2."packageId" AND p."category" = 'MICE'
  CROSS JOIN LATERAL unnest(string_to_array(i2."itemDescription", '|')) WITH ORDINALITY AS t(part, ord)
  WHERE i2."itemDescription" <> ''
    AND i2."itemDescription" NOT LIKE '%<%'
    AND i2."itemDescription" NOT LIKE '%' || E'\n' || '%'
    AND btrim(part) <> ''
  GROUP BY i2."id"
) AS sub
WHERE i."id" = sub."id";
