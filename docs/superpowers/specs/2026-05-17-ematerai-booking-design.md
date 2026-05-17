# E-Meterai Booking Integration — Design Spec

**Date:** 2026-05-17  
**Status:** Draft  
**Feature Branch:** feat/ematerai-booking

---

## Overview

Integrasi E-Meterai Peruri ke dalam flow booking. Ketika user membuat booking baru dengan toggle `withMaterai = true`, sistem memanggil Peruri API (On-Premise single mode) untuk mendapatkan Serial Number + QR image base64. QR image disimpan di `ApprovalRecord` dan ditampilkan di PDF PO booking.

Tidak menggunakan Sign Adapter (Docker) dan tidak ada upload PDF ke Peruri. Stamping bersifat visual — QR code dirender langsung dari base64 yang tersimpan di DB.

---

## Architecture

```
User (booking-drawer.tsx)
  ↓ submit withMaterai = true
Server Action: createBooking
  ↓
lib/peruri.ts: getPeruriToken()
  ├── cache hit → pakai token yang ada
  └── cache miss → POST /api/users/login → cache 23 jam
  ↓
lib/peruri.ts: generateEmaterai()
  → POST stampv2[stg].e-meterai.co.id/chanel/stampv2
  ← { sn, Image: base64QR }
  ↓
db.$transaction([
  db.booking.create({ withMaterai: true }),
  db.approvalRecord.create({ emateraiSN, emateraiQrBase64 }),
  db.snapCustomer.create(),
  db.snapVenue.create(),
  ...semua snap tables
])
  ↓ jika Peruri fail → throw → booking tidak tersimpan (rollback)
  ↓ jika DB fail → throw → return error ke client
  ↓
Return { success: true }
  ↓
POPdfDocument renders QR dari emateraiQrBase64
```

---

## Peruri API — Single Mode (On-Premise)

### Login
```
POST https://backendservicestg.e-meterai.co.id/api/users/login
Body: { "user": "...", "password": "..." }
Response: { "statusCode": "00", "token": "JWT..." }
```
Token valid 24 jam. Cache di module-level memory selama 23 jam.

### Generate Serial Number
```
POST https://stampv2stg.e-meterai.co.id/chanel/stampv2
Headers: Authorization: Bearer {JWT}
Body:
{
  "isUpload": false,
  "namadoc": "3",           // Surat Perjanjian
  "namafile": "PO-{poNumber}.pdf",
  "nodoc": "{poNumber}",    // nomor PO booking
  "tgldoc": "YYYY-MM-DD",   // tanggal booking
  "snOnly": false           // false = minta SN + QR
}
Response: {
  "statusCode": "00",
  "result": {
    "sn": "389UY343AP0GE9A40000A9",
    "Image": "<base64 QR>"
  }
}
```

**Production URLs:**
- Login: `https://backendservice.e-meterai.co.id/api/users/login`
- Generate SN: `https://stampv2.e-meterai.co.id/chanel/stampv2`

Dikontrol via `PERURI_ENV=staging|production`.

---

## Database Changes

### Booking table — tambah 1 field

```prisma
model Booking {
  // ... existing fields ...
  withMaterai Boolean @default(false)  // NEW

  // REMOVED: signatures Json?  ← deprecated, digantikan ApprovalRecord
}
```

### ApprovalRecord table — tambah 2 field

```prisma
model ApprovalRecord {
  // ... existing fields ...
  emateraiSN        String?  // NEW — serial number Peruri
  emateraiQrBase64  String?  // NEW — QR image base64 untuk PDF
}
```

### Migration

Satu migration file yang:
1. `ALTER TABLE bookings ADD COLUMN with_meterai BOOLEAN NOT NULL DEFAULT false`
2. `ALTER TABLE bookings DROP COLUMN IF EXISTS signatures`
3. `ALTER TABLE approval_records ADD COLUMN ematerai_sn VARCHAR`
4. `ALTER TABLE approval_records ADD COLUMN ematerai_qr_base64 TEXT`

---

## Error Handling

```
Peruri login fail      → throw Error → booking tidak disimpan → toast error ke user
Peruri generate SN fail:
  - statusCode 93 (kuota habis) → pesan spesifik ke user
  - statusCode 01 (token invalid) → retry login sekali, lalu throw
  - lainnya → throw generic error
DB transaction fail    → throw → return { success: false, error }
```

Tidak ada retry otomatis selain token refresh. Booking hanya tersimpan jika seluruh flow sukses.

---

## lib/peruri.ts

```ts
// JWT cache — module-level, persistent selama server hidup
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

export async function getPeruriToken(): Promise<string>
export async function generateEmaterai(poNumber: string, bookingDate: Date): Promise<{
  sn: string;
  qrBase64: string;
}>
```

---

## Server Action: createBooking

Urutan operasi (semua sebelum DB transaction):

1. Validate input dengan Zod
2. `requirePermission({ module: "booking", action: "create" })`
3. `mutationLimiter.check(...)`
4. Jika `withMaterai`:
   - `getPeruriToken()` — login jika perlu
   - `generateEmaterai(poNumber, bookingDate)` — dapat `{ sn, qrBase64 }`
5. `db.$transaction([...])` — booking + approvalRecord + semua snaps
6. `logAudit(...)` — di luar transaction (best-effort)
7. `revalidateTag("bookings", "max")`

---

## POPdfDocument Changes

Tambah optional prop:
```ts
interface POPdfDocumentProps {
  booking: POPdfBooking;
  logoBase64?: string | null;
  termAndConditionHtml?: string | null;
  ematerai?: {        // NEW
    sn: string;
    qrBase64: string;
  } | null;
}
```

### Signature Section Layout (jika ematerai ada)

```
┌────────────────────┐  ┌──────────────────────────┐
│ E-METERAI          │  │ CLIENT                   │
│ ┌──────────────┐   │  │ [signature box]          │
│ │  QR IMAGE    │   │  │ (Nama Client)            │
│ │  (80x80pt)   │   │  ├──────────────────────────┤
│ └──────────────┘   │  │ SALES                    │
│ No. [SN...]        │  │ [signature box]          │
│ (font size 6)      │  │ (Nama Sales)             │
└────────────────────┘  ├──────────────────────────┤
                        │ MANAGER                  │
                        │ [signature box]          │
                        │ (Nama Manager)           │
                        └──────────────────────────┘
```

Jika `ematerai` null → layout existing (signature section saja, tanpa kolom kiri).

Signatures section yang sebelumnya baca dari `booking.signatures` (deprecated)
→ diganti baca dari `ApprovalRecordStep.signature` (dipass via prop).

---

## booking-drawer.tsx Changes

Tambah toggle di bagian form (setelah section pembayaran atau di bawah):

```tsx
<FormField
  control={form.control}
  name="withMaterai"
  render={({ field }) => (
    <FormItem className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <FormLabel>E-Meterai</FormLabel>
        <p className="text-xs text-muted-foreground">
          Bubuhkan e-meterai pada dokumen PO
        </p>
      </div>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
    </FormItem>
  )}
/>
```

---

## Environment Variables

```env
# Peruri credentials
PERURI_USERNAME=email@account.com
PERURI_PASSWORD=yourpassword
PERURI_ENV=staging   # staging | production
```

---

## Files Changed / Created

| File | Action |
|------|--------|
| `lib/peruri.ts` | CREATE — JWT cache + generateEmaterai() |
| `lib/validations/booking.ts` | UPDATE — tambah `withMaterai: z.boolean()` |
| `actions/booking.ts` | UPDATE — createBooking: tambah Peruri call + rollback |
| `prisma/schema.prisma` | UPDATE — +1 field Booking, +2 field ApprovalRecord, -1 field Booking |
| `prisma/migrations/...` | CREATE — migration SQL |
| `components/pdf/POPdfDocument.tsx` | UPDATE — prop ematerai + layout kiri-kanan |
| `app/.../booking-drawer.tsx` | UPDATE — tambah Switch toggle |

---

## Out of Scope (tidak dikerjakan sekarang)

- Batch mode e-meterai
- Retry UI di detail booking
- Check saldo sebelum generate SN
- Sign Adapter / PDF stamping kriptografis
- E-meterai untuk BookingRevision
