# Tampilkan Pembayaran di PO (Payment "Show in PO" Toggle)

**Tanggal:** 2026-07-14
**Branch:** feat/crm
**Status:** Approved — siap masuk implementation plan

---

## 1. Masalah & Konteks

User bingung soal relasi Term of Payment (TOP) ↔ cashflow, di mana invoice hidup, dan di mana status pembayaran (paid/partial/unpaid vs verified/unverified) seharusnya disimpan.

**Temuan penting:** ~90% dari yang user bingungin **SUDAH DIBANGUN** di Fase 4-5 (Ledger/Cashbook cutover, branch feat/crm belum commit):

| Kebingungan user | Realita di codebase |
|---|---|
| "status paid/partial/unpaid harusnya di TOP" | Ada — tapi **derived**, bukan disimpan. `deriveTermStatus(amount, paidGross, dueDate, now)` di `lib/queries/ledger.ts`. TOP = jadwal murni. |
| "pembayaran harusnya di cashflow" | Betul, sudah begitu. `Ledger` (direction `in`/`out`) = single source of truth cash. |
| "di cashflow ada status verified/belum" | Ada — `Ledger.ackStatus` (pending/acknowledged/rejected). |
| "invoice per termin" | `TOP.invoiceNumber` = INV (Roman). `Ledger.invoiceNumber` = Kwitansi /KW (numeric). Dua-duanya sudah ada. |

**Yang GENUINELY BARU (scope spec ini):** waktu create/edit booking, kasih toggle per-pembayaran (cash-in) yang nyimpen `true/false`, buat nandain pembayaran mana yang tampil di **Summary Payment** PO PDF (`components/pdf/POPdfDocument.tsx`).

---

## 2. Keputusan Terkunci

1. **Status TOP = derived** (bukan disimpan). Pertahankan arsitektur Fase 5 yang udah bayar cost migrasinya. Single source of truth = Ledger. Ga ada kolom status baru di TOP.
2. **Granularity toggle = per-pembayaran (cash-in / Ledger row)**. Bukan per-termin, bukan global booking.
3. **Toggle ON cukup** — pembayaran yang toggle-nya ON langsung tampil di PO **tanpa nunggu verifikasi Finance** (pending pun tampil). Yang di-exclude cuma yang **voided** (`voidedAt != null`).
4. **Default OFF** — cash-in baru lahir `showInPo = false`. User harus sengaja nyalain.

---

## 3. Ruang Lingkup

### In scope
- Kolom baru `Ledger.showInPo Boolean @default(false)`.
- Toggle "Tampilkan di PO" di payment step (create wizard step 6 + edit booking `EditPaymentStep.tsx`), untuk row pembayaran baru maupun riwayat cash-in existing.
- Live-fetch pembayaran `showInPo:true, voidedAt:null` saat render PO → section Summary Payment nampilin baris pembayaran + hitung Sisa Bayar.

### Out of scope
- Halaman Cashbook & AR (ga berubah — toggle ga muncul di sana).
- Upload bukti bayar S3 (GAP existing dari Fase 4, di luar fitur ini).
- Refund / AP / `direction=out` (Fase 6).
- Perubahan skema/logika status termin (tetap derived).

---

## 4. Desain per Layer

### 4.1 Skema & Migration
`prisma/schema.prisma` — model `Ledger`:
```prisma
showInPo Boolean @default(false)
```
Migration idempotent (`ALTER TABLE "ledger" ADD COLUMN IF NOT EXISTS "showInPo" BOOLEAN NOT NULL DEFAULT false;`), di-commit bareng perubahan schema. Nama: `add_show_in_po_to_ledger`.

### 4.2 Server Actions — `actions/ledger.ts`
- `createCashInSchema`: tambah field `showInPo: z.boolean().default(false)`.
- `createCashIn`: simpan `showInPo` ke row Ledger baru.
- **Action baru** `setLedgerShowInPo(ledgerId, value)`:
  - `requirePermission({ module: "finance-ar", action: "edit" })` (destructure `{ session, error }`).
  - `mutationLimiter.check(\`show-in-po:${session.user.id}\`)`.
  - Zod validate input (`z.object({ ledgerId: z.string(), value: z.boolean() })`).
  - `db.ledger.update` (single-table → ga wajib transaction, tapi tetap `logAudit`).
  - `logAudit({ action: "ledger.show_in_po_toggled", entityType: "ledger", entityId: ledgerId, result: "success" })`.
  - `revalidateTag("ledger", "max")` + `revalidateTag("ar-bookings", "max")`.

### 4.3 Query Layer
- `lib/queries/ledger.ts` — `BookingCashIn` interface + `getBookingCashIns`: expose `showInPo: boolean` (select kolom baru).
- `lib/queries/booking-finance-detail.ts` — `cashIns` otomatis kebawa `showInPo` (cuma re-export field, ga ada shape change lain).

### 4.4 UI — Payment Step
`EditPaymentStep.tsx` (edit) + create-wizard step 6:
- **Row pembayaran baru:** Switch "Tampilkan di PO" di `PaymentRow`, default OFF → dikirim ke `createCashIn` sebagai `showInPo`.
- **Riwayat cash-in existing:** Switch inline per baris riwayat → panggil `setLedgerShowInPo(ledger.id, value)` → optimistic/`router.refresh()` habis sukses.
- Pakai `Switch` shadcn + label brand token (ga ada hardcode warna). Icon Solar BoldDuotone kalau perlu.

### 4.5 Render PO
`app/api/render-po/route.tsx`:
- Setelah resolve booking (live atau revisi), **selalu live-fetch** pembayaran:
  ```ts
  db.ledger.findMany({
    where: { bookingId, direction: "in", showInPo: true, voidedAt: null },
    orderBy: { occurredAt: "asc" },
    select: { id, occurredAt, amount, invoiceNumber, notes, ... },
  })
  ```
  Payments = event setelah snapshot freeze → **selalu live**, ga ikut snapshot revisi.
- Map ke `poPayments[]` dan teruskan ke `POPdfBooking`.

`components/pdf/POPdfDocument.tsx`:
- `POPdfBooking` interface: tambah `poPayments?: { label: string; amount: number; occurredAt: string; invoiceNumber: string | null }[]`.
- Section **Summary Payment** (existing ~L785-816): render tiap baris `poPayments`, lalu:
  - **Total Payment** = harga paket − diskon (tetap seperti existing).
  - **Σ Dibayar** = Σ amount `poPayments` (gross).
  - **Sisa Bayar** = Total − Σ Dibayar.
- **Edge case:** kalau `poPayments` kosong (ga ada toggle ON) → section tampil seperti sekarang (kontrak only, Sisa Bayar = Total). Zero-regression.

---

## 5. Data Flow

```
Create/Edit booking → payment step
  └─ Switch "Tampilkan di PO" (default OFF)
       ├─ row baru  → createCashIn({ ..., showInPo })
       └─ riwayat   → setLedgerShowInPo(ledgerId, value)
                          └─ Ledger.showInPo = value  → revalidate ledger/ar-bookings

Render PO (route.tsx)
  └─ live-fetch Ledger where showInPo:true AND voidedAt:null (direction in)
       └─ poPayments[] → POPdfDocument Summary Payment
            └─ Sisa Bayar = Total − Σ(pembayaran toggle-ON, non-void)
```

---

## 6. Edge Cases

| Kasus | Perilaku |
|---|---|
| Ga ada toggle ON | PO tampil seperti sekarang (kontrak only). Zero-regression. |
| Pembayaran di-void setelah toggle ON | Otomatis hilang dari PO (`voidedAt:null` filter). |
| Pembayaran masih pending (belum di-ack) | Tetap tampil di PO (keputusan #3: toggle ON cukup). |
| Render PO dari revisi/snapshot lama | Payments **selalu live-fetch**, ga ikut freeze snapshot. |
| Toggle di-nyalain lalu dimatiin lagi | `setLedgerShowInPo(false)` → hilang dari PO next render. |

---

## 7. Kepatuhan (AGENTS.md)

- Mutation: `requirePermission` + `mutationLimiter` + Zod + `logAudit` + `revalidateTag(..,"max")`.
- Migration idempotent + committed bareng schema.
- Ga ada hardcode warna (brand token only). Switch dari shadcn (`components/ui`, ga di-edit manual).
- No auto-commit — user review dulu sebelum commit.
