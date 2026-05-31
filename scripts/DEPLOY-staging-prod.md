# Panduan Deploy Migration ke Staging / Production

> Konteks: dev sudah `migrate reset` (bersih). Staging & prod **TIDAK boleh** di-reset
> karena ada data. Prioritas: **`users` + `profiles` wajib selamat**. Data `packages`
> & `bookings` boleh hilang.

## Kenapa butuh langkah khusus

`prisma migrate deploy` akan apply migration yang belum keapply. Dua di antaranya
**akan GAGAL** kalau tabel package/booking masih berisi data lama:

| Migration | Operasi | Kenapa gagal di DB berisi data |
|---|---|---|
| `20260530053946` | `SET NOT NULL` pada `package_category_prices.packageId`, `package_internal_items.packageId`, `package_vendor_items.packageId` | Migration flatten sebelumnya menambah kolom ini sebagai NULLABLE **tanpa backfill** → baris lama NULL → error `column contains null values` |
| `20260530000001` | `CREATE UNIQUE INDEX` active booking | Gagal kalau ada duplikat (venueId+date+session) active booking |

Solusi: **kosongkan tabel package + booking dulu**, baru `migrate deploy`.
Tidak ada migration yang menghapus baris `users`/`profiles` (yang ada cuma
`DROP COLUMN profiles.timezone` — buang 1 kolom, baris tetap utuh). Jadi **aman**.

---

## Langkah ( jalankan PER environment: staging dulu, lalu prod )

### 0. Backup dulu (WAJIB untuk prod)
Ambil snapshot Neon (branch/restore point) sebelum mulai. Ini jaring pengaman.

### 1. Arahkan koneksi ke environment target
Set `DATABASE_URL` + `DIRECT_URL` ke **staging** (atau prod). Jangan pakai `.env` dev.
Paling aman lewat env var sementara di terminal, bukan menimpa file `.env`.

PowerShell:
```powershell
$env:DATABASE_URL = "<connection-string-staging>"
$env:DIRECT_URL   = "<direct-connection-string-staging>"
```

### 2. Cek dulu kondisi DB (opsional tapi disarankan)
```powershell
node scripts/check-db-state.mjs   # kalau script ini relevan
```
Atau cek manual jumlah baris users/profiles supaya nanti bisa dibandingkan.

### 3. Jalankan cleanup SQL (kosongkan package + booking saja)
```powershell
npx prisma db execute --file scripts/cleanup-package-booking-before-deploy.sql --schema prisma/schema.prisma
```
> File ini **tidak menyentuh** users, profiles, sessions, roles, permissions.
> Hanya package, booking, snap_*, settlements, leads, dan approval records.

⚠️ **Catatan approval_records:** script men-`TRUNCATE` SELURUH `approval_records`
& `approval_record_steps` (semua module, bukan cuma package/booking). Kalau di
staging/prod sudah ada approval module lain yang ingin dipertahankan (mis.
quotation), beri tahu dulu — bisa diganti jadi `DELETE ... WHERE module IN
('package','booking')`. Untuk sekarang diasumsikan aman dikosongkan.

### 4. Apply migration
```powershell
npx prisma migrate deploy
```
Harusnya semua migration apply bersih sampai `20260530053946` dan seterusnya.

### 5. Verifikasi users/profiles utuh + tabel package/booking kosong
```powershell
npx prisma db execute --stdin --schema prisma/schema.prisma
```
lalu tempel:
```sql
SELECT 'users' AS tbl, COUNT(*) FROM "users"
UNION ALL SELECT 'profiles', COUNT(*) FROM "profiles"
UNION ALL SELECT 'packages', COUNT(*) FROM "packages"
UNION ALL SELECT 'bookings', COUNT(*) FROM "bookings";
```
Harapan: `users` & `profiles` = jumlah lama (tidak berubah); `packages` & `bookings` = 0.

### 6. Seed ulang data package + reference (JANGAN `migrate reset` / `db:seed` penuh)
`npm run db:seed` (full) aman-aman saja karena seeder reference pakai `upsert`/
`ON CONFLICT DO NOTHING`, TAPI seeder users juga ikut jalan. Kalau mau **hanya**
isi ulang package tanpa menyentuh user yang sudah ada, jalankan seeder spesifik:

```powershell
npm run db:seed:packages
```

> ⚠️ `seeders/packages.ts` baris ~14 ada `booking.deleteMany({})`. Di staging ini
> aman karena booking memang sudah dikosongkan di langkah 3. Jangan kaget.

### 7. Smoke test
- Login pakai user lama (buktikan users/profiles selamat).
- Buka `/dashboard/packages` → data hasil seed muncul.
- Buka `/dashboard/booking-weddings` → kosong (sesuai harapan).

---

## Ringkasan satu layar
```
staging:
  set DATABASE_URL + DIRECT_URL -> staging
  npx prisma db execute --file scripts/cleanup-package-booking-before-deploy.sql --schema prisma/schema.prisma
  npx prisma migrate deploy
  npm run db:seed:packages
  (verifikasi users/profiles utuh)

prod: ulangi langkah yang sama setelah staging sukses (backup dulu!)
```
