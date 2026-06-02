-- ============================================================================
-- cleanup-sync-safe.sql
-- ----------------------------------------------------------------------------
-- Versi PROD-SAFE dari cleanup-package-booking-before-deploy.sql.
--
-- BEDA UTAMA: tiap TRUNCATE di-guard `to_regclass(...)` — tabel yang BELUM ada
-- di target (mis. `snap_package_pricing` ABSENT di PROD) di-SKIP, tidak bikin
-- transaksi rollback. Script lama TRUNCATE langsung -> error di PROD.
--
-- TUJUAN: kosongkan SEMUA data package & booking + turunannya sebelum
--   `prisma migrate deploy`, supaya migration 20260530053946 (SET NOT NULL
--   packageId) apply bersih.
--
-- AMAN: TIDAK menyentuh users, profiles, sessions, accounts, roles,
--   permissions, role_permissions. Lihat array di bawah — tak ada tabel auth.
-- ============================================================================

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'approval_record_steps',
    'approval_records',
    'booking_revisions',
    'booking_payment_settlements',
    'term_of_payments',
    'snap_bonuses',
    'snap_vendor_items',
    'snap_package_category_prices',
    'snap_package_pricing',
    'snap_package_internal_items',
    'snap_package_vendor_items',
    'snap_packages',
    'snap_venues',
    'snap_customers',
    'bookings',
    'package_category_prices',
    'package_vendor_items',
    'package_internal_items',
    'packages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', t);
      RAISE NOTICE 'truncated %', t;
    ELSE
      RAISE NOTICE 'skipped (absent) %', t;
    END IF;
  END LOOP;
END $$;
