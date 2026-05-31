-- ============================================================================
-- cleanup-package-booking-before-deploy.sql
-- ----------------------------------------------------------------------------
-- TUJUAN:
--   Mengosongkan SEMUA data package & booking (beserta tabel turunannya)
--   SEBELUM menjalankan `prisma migrate deploy` di staging / production yang
--   SUDAH punya data lama.
--
-- KENAPA PERLU:
--   Migration `20260530053946` menjalankan SET NOT NULL pada:
--     - package_category_prices.packageId
--     - package_internal_items.packageId
--     - package_vendor_items.packageId
--   Migration flatten sebelumnya (20260530000003) menambah kolom packageId
--   sebagai NULLABLE tanpa backfill, jadi baris lama akan NULL -> migrate
--   deploy GAGAL ("column contains null values").
--   Migration `20260530000001` juga membuat UNIQUE INDEX active booking yang
--   gagal jika ada duplikat active booking.
--   Dengan mengosongkan tabel ini dulu, migration apply BERSIH.
--
-- AMAN UNTUK users & profiles:
--   Script ini TIDAK menyentuh `users`, `profiles`, `sessions`, `accounts`,
--   `roles`, `permissions`, atau tabel auth apa pun. Hanya package & booking.
--
-- CARA PAKAI: lihat scripts/DEPLOY-staging-prod.md
-- ============================================================================

BEGIN;

-- Child / dependent tables dulu, lalu parent. CASCADE menjaga FK aman.
TRUNCATE TABLE
  "approval_record_steps",
  "approval_records",
  "booking_revisions",
  "booking_payment_settlements",
  "term_of_payments",
  "snap_bonuses",
  "snap_vendor_items",
  "snap_package_category_prices",
  "snap_package_pricing",
  "bookings",
  "package_category_prices",
  "package_vendor_items",
  "package_internal_items",
  "packages",
  "leads",
  "lead_statuses"
RESTART IDENTITY CASCADE;

COMMIT;

-- Verifikasi cepat (jalankan terpisah kalau mau):
--   SELECT 'packages' AS tbl, COUNT(*) FROM "packages"
--   UNION ALL SELECT 'bookings', COUNT(*) FROM "bookings"
--   UNION ALL SELECT 'users', COUNT(*) FROM "users"
--   UNION ALL SELECT 'profiles', COUNT(*) FROM "profiles";
-- Harapan: packages=0, bookings=0, users=TETAP, profiles=TETAP.
