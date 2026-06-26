# Absensi Module Design

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** Sub-modul pertama dari HR & Payroll — Clock In/Out dengan selfie dan validasi GPS

---

## Overview

Modul Absensi memungkinkan karyawan melakukan clock in dan clock out harian via browser (desktop maupun mobile). Setiap absensi wajib disertai selfie sebagai bukti dan validasi GPS agar karyawan berada dalam radius kantor. Admin/HR dapat melihat rekap kehadiran seluruh karyawan.

---

## Scope

- Clock in/out dengan selfie (foto disimpan di R2)
- Validasi GPS — hanya bisa absen dalam radius kantor
- Jam kerja tetap (tidak ada sistem shift)
- Admin/HR tidak bisa koreksi record absensi
- Rekap filter per karyawan dan per tanggal
- Konfigurasi lokasi kantor dan jam kerja dari UI (oleh admin/HR)
- Responsive — berfungsi di desktop dan mobile

**Di luar scope:** face recognition, shift management, koreksi absensi, integrasi penggajian (dihandle modul berikutnya).

---

## Data Model

### Model `Attendance`

```prisma
model Attendance {
  id               String    @id @default(cuid())
  profileId        String
  date             DateTime  // date only (stored as midnight UTC)

  clockInAt        DateTime?
  clockInPhotoUrl  String?
  clockInLat       Float?
  clockInLng       Float?

  clockOutAt       DateTime?
  clockOutPhotoUrl String?
  clockOutLat      Float?
  clockOutLng      Float?

  status           AttendanceStatus @default(absent)

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  profile          Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, date])
  @@index([profileId])
  @@index([date])
  @@map("attendances")
}

enum AttendanceStatus {
  on_time
  late
  absent
}
```

### Model `AttendanceSettings`

```prisma
model AttendanceSettings {
  id                   String   @id @default(cuid())
  workStartTime        String   // "08:00"
  workEndTime          String   // "17:00"
  lateToleranceMinutes Int      @default(15)
  officeLatitude       Float
  officeLongitude      Float
  officeRadiusMeters   Int      @default(100)

  updatedAt            DateTime @updatedAt

  @@map("attendance_settings")
}
```

---

## Pages

### `/dashboard/hr/absensi` — Halaman Karyawan

Dapat diakses oleh semua karyawan dengan permission `hr:view`.

**Layout:**
- Card status: tanggal + jam real-time (polling 1 detik), status absensi hari ini
- Tombol Clock In → flow: cek GPS → buka kamera → ambil selfie → konfirmasi → submit
- Setelah clock in: tombol berganti Clock Out, tampilkan jam clock in
- Setelah clock out: tombol disabled sampai hari berikutnya
- Tabel riwayat 30 hari terakhir (Tanggal, Clock In, Clock Out, Status)

**GPS Flow:**
1. Browser meminta izin geolocation
2. Hitung jarak ke koordinat kantor
3. Jika di luar radius → tampil error toast, blokir aksi
4. Jika dalam radius → lanjut ke kamera

**Camera Flow:**
1. Buka modal dengan `<video>` stream dari kamera
2. Karyawan klik "Ambil Foto" → capture frame ke `<canvas>`
3. Preview foto → "Gunakan Foto" atau "Ulangi"
4. Submit: upload ke R2, kirim URL + koordinat ke API

### `/dashboard/hr/manajemen-kehadiran` — Halaman Admin/HR

Dapat diakses oleh user dengan permission `hr:view-all`.

**Layout:**
- Filter panel: dropdown pilih karyawan (semua atau spesifik) + bulan/tahun, atau pilih tanggal spesifik
- Tabel: Nama | Tanggal | Clock In | Clock Out | Status | Foto
- Klik ikon foto → modal preview selfie clock in dan clock out
- Badge status: Hadir (hijau/muted), Terlambat (kuning/muted), Absen (merah/destructive)

**Settings panel** (collapsible di bawah atau drawer terpisah):
- Form: jam mulai kerja, jam selesai kerja, toleransi terlambat (menit)
- Form: koordinat kantor (lat/lng) + radius (meter)
- Tombol simpan → `PUT /api/hr/attendance/settings`

---

## API Routes

### `POST /api/hr/attendance/clock-in`
- Auth: session required (`hr:view`)
- Rate limit: `mutationLimiter`
- Body: `{ photoBase64: string, lat: number, lng: number }`
- Validasi: belum clock in hari ini, dalam radius kantor
- Upload foto ke R2, buat/update record `Attendance`
- Set `status` berdasarkan `clockInAt` vs `workStartTime + lateToleranceMinutes`

### `POST /api/hr/attendance/clock-out`
- Auth: session required (`hr:view`)
- Rate limit: `mutationLimiter`
- Body: `{ photoBase64: string, lat: number, lng: number }`
- Validasi: sudah clock in hari ini, belum clock out
- Upload foto ke R2, update record `Attendance`

### `GET /api/hr/attendance/today`
- Auth: session required (`hr:view`)
- Rate limit: `apiLimiter`
- Return: record attendance hari ini untuk user yang login (atau null)

### `GET /api/hr/attendance`
- Auth: session required (`hr:view-all`)
- Rate limit: `apiLimiter`
- Query params: `profileId?`, `date?`, `month?`, `year?`
- Return: array attendance records (include profile.fullName)
- Pagination wajib (max 50 per page)

### `GET /api/hr/attendance/settings`
- Auth: session required (`hr:view`)
- Rate limit: `apiLimiter`
- Return: satu row AttendanceSettings (atau default jika belum ada)

### `PUT /api/hr/attendance/settings`
- Auth: session required (`hr:view-all`)
- Rate limit: `mutationLimiter`
- Body: Zod-validated settings object
- Upsert satu row AttendanceSettings
- logAudit: `hr.settings_updated`

---

## Permissions

| Module | Action | Siapa | Akses |
|--------|--------|-------|-------|
| `hr` | `view` | Semua karyawan | Clock in/out, lihat riwayat sendiri, baca settings |
| `hr` | `view-all` | Admin/HR | Rekap semua karyawan, ubah settings |

Permission `hr:view` dan `hr:view-all` perlu di-seed ke tabel `Permission`.

---

## File Structure

```
app/
  (private)/dashboard/hr/
    absensi/
      page.tsx
      _components/
        AttendanceClock.tsx      # card jam + status + tombol
        ClockActionButton.tsx    # clock in / clock out button
        CameraModal.tsx          # kamera + capture selfie
        AttendanceHistory.tsx    # tabel riwayat 30 hari
    manajemen-kehadiran/
      page.tsx
      _components/
        AttendanceFilter.tsx     # filter karyawan + tanggal
        AttendanceTable.tsx      # tabel rekap
        PhotoPreviewModal.tsx    # modal foto selfie
        AttendanceSettingsPanel.tsx  # form settings

app/api/hr/
  attendance/
    route.ts           # GET (rekap admin)
    clock-in/route.ts
    clock-out/route.ts
    today/route.ts
  attendance/settings/
    route.ts           # GET + PUT

hooks/
  useAttendanceToday.ts
  useAttendanceRecords.ts
  useAttendanceSettings.ts

lib/
  validations/attendance.ts   # Zod schemas
  queries/attendance.ts       # server-side read helpers

prisma/
  migrations/<timestamp>_add_attendance_tables/migration.sql
```

---

## Error Handling

| Skenario | Response |
|----------|----------|
| GPS ditolak user | Toast error: "Izin lokasi diperlukan untuk absensi" |
| Di luar radius kantor | Toast error: "Anda berada di luar area kantor (Xm dari kantor)" |
| Sudah clock in hari ini | 409 Conflict |
| Sudah clock out hari ini | 409 Conflict |
| Settings belum dikonfigurasi | Tampil banner warning di halaman absensi |
| Upload foto gagal | Toast error, jangan simpan record |

---

## Checklist Pre-Implementation

- [ ] Migration file untuk `Attendance` + `AttendanceSettings` + enum `AttendanceStatus`
- [ ] Seed permission `hr:view` dan `hr:view-all`
- [ ] Route-meta entries untuk `/dashboard/hr/absensi` dan `/dashboard/hr/manajemen-kehadiran`
- [ ] R2 upload untuk foto selfie (reuse pattern dari `lib/r2.ts`)
- [ ] Zod schema di `lib/validations/attendance.ts`
- [ ] Rate limiting di semua API routes
- [ ] `logAudit` untuk clock in, clock out, settings update
- [ ] Responsive layout (mobile + desktop)
