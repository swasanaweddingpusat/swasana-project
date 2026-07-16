# Plan — Finance AR UI Adjust (UI-first, No Migration)

> **Status:** DRAFT — desain UI, belum ada kode.
> **Author:** brodi session, 2026-07-11
> **Branch target:** `feat/crm`
> **Divalidasi dengan:** buku besar AR operasional SAMISARA (`AR SAMISARA.xlsx`, ~749 client / ~2000 termin / ~5000 kwitansi)
> **Scope:** **UI ONLY.** Tidak ada migration, tidak ada perubahan `schema.prisma`. Data booking/termin dari DB (real), field yang belum ada di DB pakai **dummy** dulu.

---

## 0. TL;DR

Menu **Termin** (`/finance/accounts-receivable/termin`) udah mewakili struktur AR yang bener — tinggal **dipoles UI-nya** biar makin dekat sama cara tim finance Samisara kerja di Excel. Plus **isi 2 halaman placeholder** (Aging & Client) yang sekarang masih "sedang disiapkan", dan bikin **preview Kwitansi** (dummy meta).

**Prinsip data:**
- 🟢 **REAL dari DB** — booking, termin, amount, due date, invoice, ack, partial payment, aging days, **Via Rekening** (field udah ada di schema, tinggal di-`select`).
- 🟡 **DUMMY** — No Kwitansi terpisah, PIC penerima, penanda tangan, jabatan, collection notes, cashback/additional/net nominal, upselling. Tandai jelas di UI biar gak ketuker sama data real.

**Yang TIDAK dikerjain di plan ini:** model `CashflowLedger`, pindah `ackStatus`, `bookingStatus = Completed`, revenue recognition, event-completion approval. Semua itu ada di [`docs/ar-ledger-system-plan.md`](./ar-ledger-system-plan.md) (butuh migration, fase terpisah).

---

## 1. Kondisi Sekarang (hasil scout 2026-07-11)

| Surface | File | Status |
|---|---|---|
| Menu **Termin** | `app/(private)/dashboard/finance/accounts-receivable/termin/page.tsx` + `_components/ar-table.tsx` | ✅ Jalan, data real. Kolom parent: Customer Event, Nama Event, Total Price, Outstanding, Jatuh Tempo, Status Booking, Status Termin, Aksi. Sub-row termin: Termin, Due Date, Amount, Status Termin, Status Invoice, Aging, Piutang Ack, Note, Aksi. |
| Tombol Card/Bell (parent) | `ar-table.tsx:302-307` | ⚠️ `disabled` "segera hadir" |
| Tombol invoice/kwitansi (sub-row) | `ar-table.tsx:453-466` | ⚠️ `disabled` "segera hadir" |
| Halaman **Aging** | `accounts-receivable/aging/page.tsx` | ❌ Placeholder "sedang disiapkan" |
| Halaman **Client** | `accounts-receivable/client/page.tsx` | ❌ Placeholder "sedang disiapkan" |
| Query AR | `lib/queries/ar.ts` | ✅ `getARBookings()` — tapi **belum select `paymentMethodId`** |
| Detail drawer | `_components/ar-detail-drawer.tsx` | ✅ Read-only, rapih |
| Aging chart (overview) | `_components/AgingBreakdownChart.tsx` | ⚠️ DUMMY hardcoded |

**Kesimpulan:** struktur udah bener, tinggal (a) poles kolom & aksi menu Termin, (b) nyalain 2 halaman kosong, (c) preview kwitansi.

---

## 2. Data Real vs Dummy — Peta Tegas

| Data yang mau ditampilin | Sumber | Cara dapat (tanpa migration) |
|---|---|:---|
| Booking + termin + amount + due + status | 🟢 REAL | udah ada di `getARBookings()` |
| Invoice number + status invoice | 🟢 REAL | udah ada (`TOP.invoiceNumber`) |
| Ack status + penanda tangan (finance) | 🟢 REAL | udah ada (`TOP.ackStatus` + `acknowledgedBy`) |
| Partial payment history | 🟢 REAL | udah ada (`TOP.partialPayments`) |
| Aging days | 🟢 REAL | udah dihitung di `ar.ts:77-79` |
| **Via Rekening** (bank tujuan) | 🟢 REAL* | `TOP.paymentMethodId` ada di schema — **tinggal tambah `select` + relasi `paymentMethod`**. *Catatan: banyak booking lama kemungkinan `null` → fallback "—". |
| **No Kwitansi** (nomor tanda terima) | 🟡 DUMMY | belum ada entity Receipt. Generate label dummy dari invoice/id. |
| **PIC penerima + jabatan** | 🟡 DUMMY | belum ada field. Hardcode contoh ("Finance"). |
| **Collection notes** (keterangan penagihan) | 🟡 DUMMY | `TOP.notes` generic dipakai apa adanya; log follow-up = dummy. |
| **Cashback / Additional / Net Nominal** | 🟡 DUMMY | belum dimodelkan. Tampilkan section dummy di drawer (opsional). |
| **Upselling per kategori** | 🟡 DUMMY | belum ada. Skip / dummy chip. |
| **Posisi kas per rekening** | 🟢 REAL* | agregat termin paid `GROUP BY paymentMethodId` (butuh select rekening; sebagian null). |

---

## 3. Ruang Lingkup Kerja (UI)

### 3.A. Poles Menu **Termin** (fokus utama) 🎯

Menu ini "udah mewakili" — adjustment-nya kosmetik + aktifin aksi:

1. **Kolom "Via Rekening" di sub-row termin.**
   - Tambah `paymentMethodId` + relasi `paymentMethod { bankName, bankAccountNumber, bankRecipient }` ke `select` di `lib/queries/ar.ts`.
   - Extend type `ARTermin` (di `types/finance.ts`): `viaRekening: string | null` (mis. `"BCA 149"` dari `bankName` + 3 digit akhir rekening).
   - Render di `ar-table.tsx` `TerminRow` — chip kecil `rounded-full` Bank-Jago style. Kalau `null` → "—".
   - **Mirror kolom "VIA" di sheet DATA Excel.**

2. **Aktifin tombol aksi sub-row** (`TerminActions`, `ar-table.tsx:447`):
   - **Download invoice** → buka **InvoicePreviewDrawer** (preview, bukan file — lihat 3.D).
   - **Download kwitansi** → buka **KwitansiPreviewDrawer** (gated `termin.status === "paid"`, konsisten `canKwitansi` existing).
   - Ganti `disabled` → `onClick` handler. Hapus title "segera hadir".

3. **Tombol parent Card/Bell** (`ar-table.tsx:302-307`):
   - **Card** → shortcut "Rekap kwitansi booking ini" (buka drawer daftar kwitansi). Boleh dummy list.
   - **Bell** → "Ingatkan penagihan" — buka popover **dummy** (draft pesan WA/email pakai `customerPhone` real + due date real). Tandai "preview".

4. **Badge "Via" & "Ack" konsisten** — reuse `StatusBadge` + `getAckBadge` yang udah ada di `ar-format.tsx`. Jangan bikin komponen badge baru.

### 3.B. Isi Halaman **Aging** (data real) 📊

Ganti placeholder `aging/page.tsx` jadi **aging bucket report** — data REAL dari `getARBookings()` (agingDays udah ada):

```
  ┌──────────────────────────────────────────────────────────────┐
  │  Aging Report                          [filter venue/sales]   │
  ├──────────────────────────────────────────────────────────────┤
  │  KPI row (5 bucket, card rounded-2xl Bank Jago):             │
  │  Not Due  │ 1–30 hr │ 31–60 hr │ 61–90 hr │ >90 hr          │
  │  Rp..     │ Rp..    │ Rp..     │ Rp..     │ Rp.. (destructive)│
  ├──────────────────────────────────────────────────────────────┤
  │  Tabel: Client │ No PO │ Termin │ Due Date │ Outstanding │   │
  │         Aging (hari) │ Bucket │ Sales                        │
  └──────────────────────────────────────────────────────────────┘
```

- **Bucketing** = fungsi UI murni dari `agingDays` (client-side, no query baru): `null/negatif → Not Due`, `1-30`, `31-60`, `61-90`, `>90`.
- Reuse `useAR()` hook — **gak perlu query/endpoint baru**.
- Baris hanya termin dengan `outstanding > 0` (status `overdue`/`unpaid`/`partial`).
- Filter reuse `ARFilterBar` (venue, sales, search).

### 3.C. Isi Halaman **Client** (data real) 👥

Ganti placeholder `client/page.tsx` jadi **AR per customer** — group `getARBookings()` by `customerEvent`:

```
  ┌──────────────────────────────────────────────────────────────┐
  │  Client Receivable                     [search client]        │
  ├──────────────────────────────────────────────────────────────┤
  │  Client        │ #Booking │ Total Kontrak │ Dibayar │ Sisa   │
  │  FELICIA & ...  │ 1        │ Rp438.8jt     │ Rp..    │ Rp..   │
  │  (klik → expand daftar booking + link ke Termin)             │
  └──────────────────────────────────────────────────────────────┘
```

- Aggregation UI murni dari `arResult.data` (client-side reduce by customer). No query baru.
- Total kontrak = Σ `totalPrice`, Dibayar = Σ(`totalPrice - outstanding`), Sisa = Σ `outstanding`.

### 3.D. **Kwitansi & Invoice Preview Drawer** (booking real, meta dummy) 🧾

Komponen baru di `accounts-receivable/_components/`:

- **`kwitansi-preview-drawer.tsx`** — layout tanda terima bergaya Samisara:
  - Header org (GUNAWARMAN / SAMISARA — dari config/dummy), **No Kwitansi** (dummy: `KW-{invoiceNumber}` atau generate), Tanggal, **Diterima dari** (customer real), **Jumlah** (amount real, + terbilang), **Via** (rekening real/null), **Keterangan** (nama termin real), **Penanda Tangan + Jabatan** (dummy "Finance").
  - Style: card `rounded-2xl`, `p-6`, `font-heading` buat nominal, print-friendly (`@media print`). Tombol "Cetak" pakai `window.print()`.
- **`invoice-preview-drawer.tsx`** — mirip, format invoice/tagihan (due date, sisa tagihan).
- Reuse `Drawer` dari `components/shared/drawer.tsx`.
- **Terbilang**: cek dulu apakah ada helper angka→kata di `lib/`; kalau belum, tambah util kecil `terbilang()` di `lib/utils.ts` (murni fungsi, bukan migration).

---

## 4. File yang Disentuh

| # | File | Perubahan |
|---|---|---|
| 1 | `lib/queries/ar.ts` | Tambah `paymentMethodId` + relasi `paymentMethod` ke `select`; map `viaRekening` ke `ARTermin`. **Read-only, no migration.** |
| 2 | `types/finance.ts` | `ARTermin`: tambah `viaRekening: string \| null`. Tambah type `AgingBucket`, `ARClientRow` (buat halaman baru). |
| 3 | `.../termin/_components/ar-table.tsx` | Kolom Via Rekening di sub-row; aktifin `TerminActions` + tombol parent Card/Bell → buka drawer. |
| 4 | `.../aging/page.tsx` | Ganti placeholder → aging bucket report (real). |
| 5 | `.../client/page.tsx` | Ganti placeholder → AR per client (real). |
| 6 | `.../_components/kwitansi-preview-drawer.tsx` | **BARU** — preview kwitansi. |
| 7 | `.../_components/invoice-preview-drawer.tsx` | **BARU** — preview invoice. |
| 8 | `.../_components/ar-aging-view.tsx` (opsional) | **BARU** — komponen tabel + KPI aging (dipisah dari page biar rapih). |
| 9 | `.../_components/ar-client-view.tsx` (opsional) | **BARU** — komponen tabel client. |
| 10 | `lib/utils.ts` | (kalau perlu) util `terbilang()` angka→kata Indonesia. |

**Tidak disentuh:** `schema.prisma`, `prisma/migrations/`, `components/ui/*`.

---

## 5. Aturan Main (biar konsisten repo)

- **Design system Bank Jago** (AGENTS.md §12): card `rounded-2xl`, chip/pill `rounded-full`, `p-5/p-6`, `shadow-sm`, angka gede `font-heading`, warna cuma token (ink/gold/cream + destructive). **No hardcode hex.**
- **Icon**: Solar `weight="BoldDuotone"` (AGENTS.md §12). Reuse yang udah keimport.
- **Tailwind v4** (§13): `data-attr:`, suffix `!`, canonical class (no arbitrary `[Npx]`).
- **ESLint** (§14): no ternary sebagai statement — pakai `if/else`.
- **No `any`** — `unknown` + narrow.
- **Dummy jelas ditandai** — kasih label/tooltip "contoh" atau badge biar finance gak nyangka data real.
- **Reuse** — `useAR()`, `ARFilterBar`, `StatusBadge`, `Drawer`, `fmtRp`/`fmtDate`. Jangan bikin duplikat.

---

## 6. Yang SENGAJA Ditunda (butuh migration → plan lain)

| Item | Kenapa ditunda | Ada di |
|---|---|---|
| Entity `Receipt`/Kwitansi (No Kwitansi asli, PIC, ttd per-transaksi) | Butuh tabel baru | `ar-ledger-system-plan.md` |
| Pindah `ackStatus` TOP → ledger | Migration + refactor query | `ar-ledger-system-plan.md` |
| Posisi kas per rekening (real, akurat) | Butuh field KODE rekening + agregasi ledger | `ar-ledger-system-plan.md` |
| Collection log terstruktur | Butuh tabel follow-up | future |
| Cashback/Additional/Net/Upselling | Butuh dekomposisi harga di schema | future |
| Reminder otomatis (cron/email) | Butuh scheduler + template | future |

Di plan ini semua itu **dummy/preview** dulu — biar UX kelihatan utuh tanpa nyentuh DB.

---

## 7. Urutan Eksekusi (kalau di-acc)

1. **Query enrich** — `ar.ts` select `paymentMethod` + map `viaRekening` (real, aman).
2. **Menu Termin** — kolom Via + aktifin aksi (buka drawer kosong dulu).
3. **Kwitansi + Invoice preview drawer** — isi konten (booking real + dummy meta).
4. **Halaman Aging** — bucket report real.
5. **Halaman Client** — AR per client real.
6. **Polish** — badge, empty state, responsive, print CSS.

Tiap langkah bisa di-review terpisah. Data real dulu (langkah 1-2, low-risk), baru surface dummy (3-5).

---

## 8. Verifikasi (end-to-end, no migration)

- `npm run build` (Turbopack) — pastikan type `ARTermin.viaRekening` konsisten di query + table + drawer.
- Buka `/dashboard/finance/accounts-receivable/termin` — expand booking real, cek kolom Via Rekening muncul (isi/`—`), tombol kwitansi/invoice buka drawer.
- Buka `/aging` — cek bucket total = Σ outstanding per bucket masuk akal vs tabel Termin.
- Buka `/client` — cek total per client = Σ booking-nya.
- Print preview kwitansi — layout rapih di `window.print()`.
- Cek TS strict: no `any`, explicit return type di util baru.

---

*Plan ini murni UI. Tidak ada satu baris migration pun. Data booking/termin real dari DB via `getARBookings()` yang sudah ada; field yang belum dimodelkan ditampilkan sebagai dummy yang ditandai jelas. Konfirmasi scope §3 sebelum eksekusi.*
