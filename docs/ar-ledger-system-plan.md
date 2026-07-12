# Design Plan — AR + Cashflow Ledger (Buku Besar)

> **Status:** DRAFT — **FE-ONLY dulu, dummy data in-memory. TANPA backend / TANPA migration.**
> **Author:** brodi session, 2026-07-11
> **Branch target:** `feat/crm` (atau `feat/ledger`)
> **Divalidasi dengan:** buku besar AR operasional SAMISARA (Gunawarman Hallmark) — `AR SAMISARA.xlsx`
> **Menggantikan:** `docs/ledger-cashflow-design-plan.md` (draft awal — sebagian asumsinya udah di-refine di sini)

---

## ⚡ STRATEGI EKSEKUSI — FE-FIRST (BACA INI DULU)

**Keputusan user:** kita **mulai dari Frontend doang** — UI lengkap, **pake dummy data yang bisa di-input & nambah** (pura-pura, in-memory di React state). **JANGAN sentuh backend, JANGAN bikin migration, JANGAN ubah schema Prisma** dulu. Semua bagian skema DB / posting engine / approval di bawah = **REFERENSI buat nanti**, bukan yang dibangun sekarang.

**Kenapa aman:** project ini **udah punya preseden** — modul **Accounts Payable full FE-only**:
- Dummy data: `app/(private)/dashboard/finance/accounts-payable/_components/ap-dummy.ts` (const `AP_PAYABLES`)
- Page = client component, filter/pagination pake `useMemo` in-memory (`accounts-payable/outstanding/page.tsx`)
- Drawer submit cuma `toast.success(...)`, komentarnya sendiri: *"UI-first: no persistence yet. Wire to a server action once the schema lands."* (`ap-pay-drawer.tsx:59`)

Kita **niru pola itu 100%** buat Ledger. **Bedanya satu:** user mau bisa **NAMBAH data** (input transaksi baru → row langsung muncul di tabel). Jadi:

> Dummy Ledger **BUKAN** `const` mati kayak AP. Taruh di **React state** (`useState<LedgerEntry[]>(SEED_LEDGER)`) di level komponen manager, dan tombol "Catat Transaksi" nge-`append` row baru ke state itu. Data ilang pas refresh (murni pura-pura) — itu OK, memang dummy.

**Yang dibangun SEKARANG (FE-only):**
| Layer | Bikin | Catatan |
|---|---|---|
| Types | `types/finance.ts` → tambah `LedgerEntry`, `LedgerStatus`, `LedgerEntryType`, dll | mirror AR/AP types yang udah ada |
| Dummy seed | `ledger-dummy.ts` | array awal ~10-15 transaksi contoh (niru sheet DATA SAMISARA) |
| Menu | `sidebar-config.ts` + `finance-nav-config.ts` | menu "Ledger" di atas AR |
| Page + state | `finance/ledger/page.tsx` (client) | `useState` ledger array, KPI dari `useMemo`, tab in-page |
| Komponen | `ledger-table.tsx`, `ledger-filter-bar.tsx`, `ledger-summary-cards.tsx`, `ledger-entry-drawer.tsx` | niru `ap-table` / `ap-filter-bar` / `ap-summary-cards` / `ap-pay-drawer` |
| Promo (mock) | dropdown di entry drawer pake dummy promo list | hitung potongan di client, append 2 baris (cash_in + discount) |

**Yang DITUNDA (jangan disentuh sekarang):** `prisma/schema.prisma`, migration, `actions/*`, `lib/queries/*`, `lib/ledger.ts`, wiring ke `sign/route.ts`/`partial-payment.ts`/`payment-ack.ts`, permission seed. Semua nyusul **setelah UI di-acc**.

---

## 0. TL;DR

Bikin **menu baru "Ledger" di paling atas submenu Finance** (di atas Accounts Receivable) sebagai **pusat pencatatan SEMUA pergerakan uang**. Ledger = tabel `CashflowLedger` (append-only) yang tiap barisnya punya **status 3 fase**:

```
  RECEIVABLE (piutang) ──▶ UNEARNED (kredit) ──▶ EARNED (debit)
  client belum bayar        udah bayar,             acara selesai +
                            belum jadi pendapatan    4 approval → sah
```

**3 koreksi penting dari diskusi terakhir:**

1. **`ackStatus` pindah dari TOP ke LEDGER.** Konfirmasi Finance itu peristiwa **per-transaksi uang masuk**, bukan per-termin. Persis sheet `DATA` di Excel SAMISARA: tiap kwitansi punya kolom "PENANDA TANGAN: ROSITA" sendiri.
2. **Ledger kebuka pas CLIENT SIGNING** (reuse `snapshotFrozenAt` yang udah ada).
3. **Flip UNEARNED → EARNED** dipicu approval **"event-completion"** (sales → manager → finance → client) + rating + dokumen. Finance boleh **override** kalau belum lunas, dan bisa **undo** (earned → balik unearned) sewaktu-waktu.

**Pola akuntansi:** single-entry status-based (1 baris per transaksi, statusnya yang jalan), BUKAN double-entry debit/kredit klasik. Lebih kebaca buat ops, tetap ngasih semua angka (piutang, unearned, earned).

**Promo/Discount:** modul `DiscountProgram` **udah ada** + UI picker-nya **udah kebangun** di TOP drawer (skrg dimatiin `{false && ...}`, komentarnya sendiri: *"hidden until wired to real DB"*). Tiap **pembayaran** bisa ikut promo — potongan dihitung dari **nominal yang dibayar** (bukan harga paket), ngurangin piutang: client bayar lebih dikit, termin tetep lunas. Potongan = **bukan uang masuk, bukan pendapatan** (contra-receivable). Detail §6.5.

**Scope:** cuma **AR** (uang masuk dari client). Cash-out ke vendor = **AP**, dibahas terpisah.

---

## 1. Latar Belakang & Koreksi Kunci

### 1.1. Masalah yang dipecahkan

Sistem sekarang **berhenti di "uang masuk"**. Alurnya:

```
  booking → termin (TOP) → client bayar → finance ack → DONE (masuk laporan kas)
```

Yang HILANG: konsep **"uang masuk ≠ pendapatan"**. Di bisnis wedding, client bayar jauh sebelum acara. Uang yang udah masuk itu **belum jadi milik lo** sampai acaranya beneran dilaksanakan. Kalau client batal, uang balik. Jadi statusnya masih **titipan/kewajiban** (kredit), bukan pendapatan (debit).

### 1.2. Koreksi: `ackStatus` salah tempat

**Kondisi sekarang** (`prisma/schema.prisma:1148-1151`):

```prisma
model TermOfPayment {
  ackStatus        String    @default("pending")  // ❌ salah level
  acknowledgedAt   DateTime?
  acknowledgedById String?
}
```

**Kenapa salah:** satu termin bisa dibayar **dicicil beberapa kali** (`PartialPayment`). Tiap cicilan = 1 transaksi uang masuk = 1 kwitansi. Tapi `ackStatus` di TOP cuma bisa nyimpen **1 konfirmasi** untuk seluruh termin — padahal tiap kwitansi harusnya dikonfirmasi Finance sendiri-sendiri.

**Bukti dari Excel SAMISARA — sheet `DATA` (ledger asli mereka):**

| TANGGAL | NAMA | JUMLAH BAYAR | NO KWITANSI | VIA | **PENANDA TANGAN** |
|---|---|---|---|---|---|
| 2 Jan | RIDHO & TIARA | 30.000.000 | 905/SMSR-GWN/I/25 | BCA 149 | **ROSITA** |
| 12 Jan | AURA & ADI | 55.000.000 | 929/SMSR-GWN/I/25 | BCA 149 | **ROSITA** |

Tiap baris (transaksi) punya penanda tangan sendiri. **Itu level ledger, bukan termin.** Koreksi lo 100% bener.

### 1.3. Glossary (bahasa manusia)

| Istilah | Arti di project ini |
|---|---|
| **Receivable (Piutang)** | Client udah teken kontrak tapi belum bayar. "Hutang client ke lo." |
| **Unearned (Kredit)** 🔵 | Uang UDAH masuk rekening, TAPI acara belum jalan → belum jadi pendapatan. Titipan. |
| **Earned (Debit)** 🟢 | Pendapatan SAH. Acara selesai + 4 approval → uang jadi milik lo. |
| **Recognition** | Momen flip `unearned → earned`. Trigger: acara selesai + approval lengkap. |
| **Ack (Acknowledge)** | Finance konfirmasi 1 transaksi uang beneran masuk (per kwitansi). |
| **Append-only** | Baris ledger gak pernah diedit/dihapus. Koreksi = baris baru. |

---

## 2. Validasi dari Excel SAMISARA

Excel mereka udah misahin TOP dan Ledger secara natural — kita tinggal niru strukturnya:

```
  ┌────────────────────────┐         ┌────────────────────────────┐
  │  SHEET "SKEMA BAYAR"    │         │      SHEET "DATA"          │
  │  = TOP (rencana)       │◀──🔑───▶│  = LEDGER (kenyataan)      │
  ├────────────────────────┤ invoice ├────────────────────────────┤
  │  No Invoice            │         │  No Invoice ────────────┐  │
  │  Nominal (hrs bayar)   │         │  Tanggal (uang masuk)   │  │
  │  Due Date              │         │  Jumlah Bayar           │  │
  │  Sisa Tagihan ◀────────┼─ dihitung│  No Kwitansi            │  │
  │  Status (LUNAS?)       │  dari    │  Via (rekening)         │  │
  │                        │  ledger  │  Penanda Tangan (ack) ◀─┘  │
  └────────────────────────┘         └────────────────────────────┘
         di app = TOP                   di app = CashflowLedger (BARU)
```

**Yang app kita udah punya:** TOP (`TermOfPayment`), rekening (`PaymentMethod`), partial payment.
**Yang belum:** tabel ledger (`DATA`), status unearned/earned, ack per-transaksi.

---

## 3. Konsep Inti — 3 Fase Status

Tiap termin yang masuk ledger jalan lewat 3 fase. **Statusnya yang berubah, barisnya tetap** (kecuali cash-in nambah baris baru):

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │  SATU TERMIN — TIGA FASE                                            │
 ├─────────────────────────────────────────────────────────────────────┤
 │                                                                     │
 │  ┌───────────────┐  client bayar   ┌───────────────┐  acara kelar  │
 │  │  FASE 1       │  + finance ack   │  FASE 2       │  + 4 approve  │
 │  │  RECEIVABLE   │ ───────────────▶ │  UNEARNED 🔵  │ ────────────▶ │
 │  │  (piutang)    │                  │  (kredit)     │               │
 │  └───────────────┘                  └───────────────┘               │
 │   posisi: —                          posisi: KREDIT                 │
 │   uang blm masuk                     uang masuk, blm jd pendapatan  │
 │   → hitungan PIUTANG                  → hitungan UANG MASUK          │
 │                                                    │                │
 │                                                    ▼                │
 │                                          ┌───────────────┐          │
 │                                          │  FASE 3       │          │
 │                                          │  EARNED 🟢    │          │
 │                                          │  (debit)      │          │
 │                                          └───────────────┘          │
 │                                           posisi: DEBIT             │
 │                                           pendapatan SAH            │
 │                                           → hitungan REVENUE        │
 └─────────────────────────────────────────────────────────────────────┘
```

### Contoh angka nyata (booking 50jt, 3 termin)

```
  TAHAP                          LEDGER STATE
  ────────────────────────────────────────────────────────────────
  1. Client signing 🖋️           3 baris receivable:
                                   • DP        15jt  [receivable]
                                   • Termin 2  20jt  [receivable]
                                   • Pelunasan 15jt  [receivable]
                                 ─────────────────────────────────
                                 PIUTANG: 50jt · UNEARNED: 0 · EARNED: 0

  2. Client bayar DP + ack 💰    DP flip → unearned:
                                   • DP        15jt  [unearned] 🔵
                                   • Termin 2  20jt  [receivable]
                                   • Pelunasan 15jt  [receivable]
                                 ─────────────────────────────────
                                 PIUTANG: 35jt · UNEARNED: 15jt · EARNED: 0

  3. Semua lunas + ack           semua unearned:
                                 ─────────────────────────────────
                                 PIUTANG: 0 · UNEARNED: 50jt · EARNED: 0

  4. Acara selesai + 4 approve   semua flip → earned:
     + rating + dokumen 🟢       ─────────────────────────────────
                                 PIUTANG: 0 · UNEARNED: 0 · EARNED: 50jt ✅
```

---

## 4. Arsitektur Menu — "Ledger" Baru di Atas AR

**Lokasi:** `sidebar-config.ts:183-208` + `finance-nav-config.ts:32-60`.

```
  SEBELUM                          SESUDAH
  ────────                         ────────
  Finance                          Finance
  ├─ Overview                      ├─ Overview
  ├─ Accounts Receivable           ├─ 🆕 Ledger (Buku Besar)  ◀── PALING ATAS, 1 halaman
  │  ├─ Termin                     ├─ Accounts Receivable
  │  ├─ Aging                      │  ├─ Termin
  │  └─ Client                     │  ├─ Aging
  └─ Accounts Payable              │  └─ Client
     ├─ Outstanding                └─ Accounts Payable
     ├─ Event                         ├─ Outstanding
     └─ Expense                       ├─ Event
                                      └─ Expense
```

**Route baru (keputusan lo: 1 halaman cover semua):**
- `/dashboard/finance/ledger` — satu halaman: KPI (Piutang/Unearned/Earned/Potongan) di atas + tabel semua transaksi (mirror sheet `DATA`), difilter/tab in-page buat liat unearned/earned. Gak dipecah jadi sub-route.

**Icon** (udah keimport di `sidebar-config.ts`): pakai `Bill` — Solar BoldDuotone.

**Permission baru:** module `ledger` → `view`, `ack`, `recognize`, `export` (tambah ke seed + AGENTS.md §5). `recognize` dipakai buat flip earned + override belum-lunas + undo.

> **Hubungan Ledger ↔ AR:** menu **AR tetap ada** — dia jadi "view rencana + piutang" (turunan dari TOP − ledger). Menu **Ledger** = "catatan kas beneran". Dua-duanya baca data yang sama, sudut pandang beda (rencana vs realisasi).

---

## 5. Skema Data

> 🔒 **REFERENSI NANTI — BUKAN scope FE-first.** Section ini (schema Prisma, enum, migration) adalah cetak biru buat fase backend belakangan. **Sekarang JANGAN dibikin.** Buat FE-only, bentuk data ini cuma ditiru jadi **TypeScript interface** di `types/finance.ts` (lihat §14), bukan model Prisma. Tetep gue simpen di sini biar pas naik ke BE tinggal contek.

### 5.1. Model baru: `CashflowLedger`

```prisma
model CashflowLedger {
  id              String            @id @default(uuid())

  // ── Keterkaitan domain ──
  bookingId       String
  termId          String?           // termin sumber (null utk entry non-termin)
  revisionId      String?           // revisi pemicu (audit trail)
  partialPaymentId String?          // link ke PartialPayment kalau cash-in dari cicilan

  // ── Klasifikasi ──
  entryType       LedgerEntryType   // receivable | cash_in | discount | recognition | adjustment | refund
  status          LedgerStatus      @default(receivable) // receivable | unearned | earned | void

  // ── Nominal ──
  amount          Int               // rupiah penuh (Int, konsisten TOP.amount)

  // ── Promo/Discount (baris entryType=discount) ──
  discountProgramId String?         // link ke DiscountProgram yg dipakai (null utk non-discount)

  // ── Konfirmasi Finance (PINDAH DARI TOP KE SINI) ──
  ackStatus       LedgerAckStatus   @default(pending)    // pending | acknowledged | rejected
  acknowledgedAt  DateTime?
  acknowledgedById String?          // profiles.id — "PENANDA TANGAN" di Excel

  // ── Referensi ──
  paymentMethodId String?           // rekening tujuan (mirror kolom "VIA")
  invoiceNumber   String?           // nomor kwitansi/invoice
  evidence        String?           // bukti transfer (storage key)

  // ── Waktu ──
  occurredAt      DateTime          // kapan uang beneran gerak
  recognizedAt    DateTime?         // kapan flip ke earned (null selama unearned)

  // ── Metadata ──
  createdById     String?
  notes           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  booking         Booking           @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  term            TermOfPayment?    @relation(fields: [termId], references: [id], onDelete: SetNull)
  revision        BookingRevision?  @relation(fields: [revisionId], references: [id], onDelete: SetNull)
  partialPayment  PartialPayment?   @relation(fields: [partialPaymentId], references: [id], onDelete: SetNull)
  paymentMethod   PaymentMethod?    @relation(fields: [paymentMethodId], references: [id], onDelete: SetNull)
  discountProgram DiscountProgram?  @relation(fields: [discountProgramId], references: [id], onDelete: SetNull)
  acknowledgedBy  Profile?          @relation("LedgerAcknowledger", fields: [acknowledgedById], references: [id], onDelete: SetNull)
  createdBy       Profile?          @relation("LedgerCreator", fields: [createdById], references: [id], onDelete: SetNull)

  @@index([bookingId])
  @@index([termId])
  @@index([status])
  @@index([entryType])
  @@index([ackStatus])
  @@index([occurredAt])
  @@index([bookingId, status])
  @@map("cashflow_ledgers")
}
```

### 5.2. Enum baru

```prisma
enum LedgerEntryType {
  receivable    // baris kontrak per termin (dibuat pas signing)
  cash_in       // uang masuk (pembayaran/cicilan)
  discount      // potongan promo — nutup piutang tapi bukan uang riil (contra-receivable)
  recognition   // penanda flip unearned → earned
  adjustment    // koreksi delta akibat revisi (append, bukan edit)
  refund        // pengembalian ke client
}

enum LedgerStatus {
  receivable    // piutang — belum dibayar
  unearned      // kredit — udah dibayar, belum jadi pendapatan
  earned        // debit — pendapatan sah (acara selesai + approve)
  void          // dibatalkan (koreksi non-destruktif)
}

enum LedgerAckStatus {
  pending       // uang masuk, Finance belum konfirmasi
  acknowledged  // Finance konfirmasi (PENANDA TANGAN)
  rejected      // ditolak (bukti gak valid, dll)
}
```

### 5.3. Perubahan model existing

**`TermOfPayment` — HAPUS 3 field ack** (pindah ke ledger):

```diff
- ackStatus        String    @default("pending")
- acknowledgedAt   DateTime?
- acknowledgedById String?
- acknowledgedBy   Profile?  @relation("TOPAcknowledger", ...)
```

> `TermOfPayment` balik ke peran murni: **rencana tagihan** (nama, amount, dueDate, status bayar). Ack pindah ke ledger.

**`Booking.paymentStatus`** (`schema:793`, free-form String yang praktis dead) → kandidat repurpose jadi status turunan atau di-drop. **Diputuskan di fase implementasi**, bukan sekarang.

**Relasi balik** (tambah `ledgerEntries CashflowLedger[]`): `Booking`, `TermOfPayment`, `BookingRevision`, `PaymentMethod`, `PartialPayment`, `Profile`.

---

## 6. Aturan Pencatatan (Posting Rules)

> 🔒 **REFERENSI NANTI — BUKAN scope FE-first.** Aturan posting (signing → receivable, bayar → cash_in, dst) ini logika **backend**. Sekarang di FE cukup **disimulasikan di client**: tombol input drawer nge-`append` row ke state array. Contoh: input pembayaran pake promo → drawer bikin 2 objek (`cash_in` + `discount`) terus `setLedger([...prev, cashInRow, discountRow])`. Gak ada `$transaction`, gak ada server action. Detail simulasi di §14.

### 6.1. Saat CLIENT SIGNING — buka ledger

**Reuse:** `app/api/client-agreement/sign/route.ts` (udah pakai `db.$transaction(ops)` array + set `snapshotFrozenAt`).

```
  Untuk tiap TermOfPayment di booking:
    → buat 1 baris ledger:
         entryType = receivable
         status    = receivable
         amount    = TOP.amount
         termId    = TOP.id
         occurredAt = signing time
```

Momen signing = mengunci **3 hal** sekaligus (tadinya 2):
1. Snapshot beku (`snapshotFrozenAt`) — existing.
2. Booking → Confirmed — existing.
3. **Ledger kebuka** (baris receivable dibuat) — BARU.

### 6.2. Saat BAYAR termin + Finance ack — cash_in (flip ke unearned)

**Reuse:** `actions/partial-payment.ts` (cash masuk) + `actions/payment-ack.ts` (konfirmasi Finance).

```
  Saat PartialPayment dibuat:
    → buat 1 baris ledger:
         entryType = cash_in
         status    = unearned  🔵
         ackStatus = pending
         amount    = nominal cicilan
         partialPaymentId, paymentMethodId, invoiceNumber, evidence

  Saat Finance ack (per baris cash_in):
    → update baris ledger:
         ackStatus       = acknowledged
         acknowledgedAt  = now
         acknowledgedById = finance profile   ← "PENANDA TANGAN"
```

> **Kredit tetap 0 di debit.** Uang masuk = status `unearned`, BUKAN `earned`. Sesuai maunya lo: dibayar tapi belum jadi pendapatan.

### 6.3. Saat ACARA SELESAI + 4 APPROVE — recognition (flip ke earned)

**Reuse:** `ApprovalRecord` + `ApprovalRecordStep` engine, module baru `event-completion`.

```
  Approval event-completion lengkap (sales→manager→finance→client)
  + WeddingIndicator (rating) terisi
  + EventEvaluation (dokumen) terisi
    → untuk semua baris ledger booking dgn status unearned:
         status       = earned  🟢
         recognizedAt = now
    → buat 1 baris penanda: entryType = recognition
    → booking.bookingStatus = "Completed" (enum baru)
```

**Override belum lunas (keputusan lo):** kalau masih ada piutang (`status = receivable`) tapi acara tetep jalan, Finance boleh **paksa recognize** — TAPI harus approve eksplisit. Baris `recognition` nyimpen `createdById = finance` + `notes` alasan override. Yang di-flip cuma yang `unearned`; piutang sisa tetep `receivable` (bisa ketagih belakangan).

**Undo (keputusan lo):** Finance bisa **balikin** `earned → unearned` sewaktu-waktu (mis. salah recognize, acara ternyata diundur):
```
  → semua baris earned booking → balik status = unearned, recognizedAt = null
  → buat 1 baris penanda: entryType = recognition, status = void, notes = "undo by <finance>"
  → booking.bookingStatus balik ke "Confirmed"
```
Append-only tetep dijaga: undo bukan hapus baris recognition lama, tapi tambah baris `recognition/void` sbg pembalik. Aksi ini `requirePermission("ledger","recognize")` + `logAudit`.

### 6.4. Revisi booking — APPEND delta

```
  Kontrak 45jt → revisi jadi 50jt:
    Entry #1 [rev-1] receivable  45jt  (beku)
    Entry #2 [rev-2] adjustment  +5jt  (baris BARU, bukan edit)
    ──────────────────────────────────
    Posisi = SUM(status != void) = 50jt
```

**Aturan:** baris lama gak pernah diedit/dihapus. Koreksi = baris baru (`adjustment`) atau `status = void` + baris pembalik.

### 6.5. Saat BAYAR pakai PROMO — cash_in + discount (dua baris)

**Reuse:** modul `DiscountProgram` (udah ada, `actions/promo.ts`) + UI picker yang **udah kebangun tapi dimatiin** di `edit-top-drawer.tsx:544` (`{false && ...}`, DUMMY_PROMOS baris 1507). Tinggal: sambungin ke `/api/promos` + kirim hasil ke posting engine.

**Basis potongan = nominal yang DIBAYAR, bukan harga paket** (sesuai keputusan lo):

```
  Contoh: harga paket 100jt, termin dibayar 50jt, promo 10%.
    potongan = 10% × 50jt = 5jt   ← basis = 50jt (yg dibayar), BUKAN 100jt
    client transfer riil          = 45jt
    piutang yg ketutup            = 50jt (termin dianggap LUNAS penuh)

  Ledger nyatet DUA baris:
    ┌─ entryType = cash_in    status = unearned  amount = 45jt  (uang riil masuk) 🔵
    └─ entryType = discount   status = unearned  amount =  5jt  (potongan promo)  🏷️
                              discountProgramId = <promo.id>
    ─────────────────────────────────────────────────────────────
    Σ nutup piutang = 45jt + 5jt = 50jt ✅   |   uang riil = 45jt saja
```

**Aturan promo:**
- Promo dipilih **per transaksi pembayaran** (bukan sekali di booking) — sesuai UI existing.
- Baris `discount`: uang **bukan** cash riil (gak nambah saldo bank), tapi **nutup piutang**. Pas recognition, ikut jadi `earned` (pendapatan sah, cuma sumbernya potongan bukan cash).
- Validasi saat apply (yang di UI existing belum ada): cek `isActive`, `periodStart/End`, `minTransaction`, `quota vs usedCount`, `eventEligibleStart/End`. → `DiscountProgram.usedCount++` (skrg gak pernah keupdate).
- `PERCENTAGE` = `round(bayar × discountValue / 100)`; `NOMINAL` = flat `discountValue` (logika ini udah ada di `edit-top-drawer.tsx` `computePotongan()`).

> **Kenapa 2 baris, bukan 1?** Biar kebedaan **uang riil masuk** (buat rekonsiliasi rekening bank / cashflow) vs **potongan** (buat laporan beban diskon). Kalau digabung jadi 1, angka bank gak akan match sama mutasi rekening.

---

## 7. Peta Reuse — Apa yang Udah Ada

| Kebutuhan | Reuse yang udah ada | File |
|---|---|---|
| Buka ledger pas signing | `$transaction` + `snapshotFrozenAt` | `app/api/client-agreement/sign/route.ts` |
| Cash-in pas bayar | partial payment flow | `actions/partial-payment.ts` |
| Ack Finance per transaksi | ack flow (pindah target ke ledger) | `actions/payment-ack.ts` |
| Recognition 4-approve | `ApprovalRecord` engine, module baru | `actions/approval.ts`, `lib/approval-flows.ts` |
| Bikin step approval | `buildBookingApprovalSteps` (parametris) | `lib/approval-flows.ts:180` |
| Rating client (tanda selesai) | `WeddingIndicator` (UDAH full + share link) | `actions/weddingIndicator.ts` |
| Dokumen evaluasi | `EventEvaluation` (model ada, logic kosong) | `prisma/schema.prisma:2568` |
| Promo/discount katalog | `DiscountProgram` + CRUD (UDAH ada) | `actions/promo.ts`, `lib/queries/promo.ts` |
| UI promo picker + hitung potongan | **udah kebangun, tinggal nyalain** (`{false && ...}`) | `edit-top-drawer.tsx:544-685` |
| List promo aktif | REST `/api/promos?activeOnly` | `app/api/promos/route.ts` |
| Rekening/bank | `PaymentMethod` | existing |
| AR read (piutang) | extend query existing | `lib/queries/ar.ts`, `lib/queries/finance.ts` |
| Audit | `logAudit()` | `lib/audit.ts` |
| Rate limit + permission | `mutationLimiter`, `requirePermission` | AGENTS.md §4 |

**Yang bikin ringan:** engine approval + signing + partial payment + rating **udah jalan**. Kerjaan inti = tabel ledger + nyambungin ke 3 titik itu.

---

## 8. Approval "Event-Completion" (Reuse Engine)

Pola persis approval booking, cuma module beda + trigger beda:

```
  ┌──────────────────────────────────────────────────────────┐
  │  MODULE: event-completion  (reuse ApprovalRecord engine)  │
  ├──────────────────────────────────────────────────────────┤
  │  Step 0: Sales     → konfirm acara kelar                  │
  │  Step 1: Manager   → approve                              │
  │  Step 2: Finance   → approve (cek semua lunas)            │
  │  Step 3: Client    → rating + feedback (WeddingIndicator) │
  │            │                                              │
  │            ▼  allSteps.every(approved)                    │
  │  ⚡ TRIGGER (beda dari booking):                          │
  │     • flip semua ledger unearned → earned 🟢             │
  │     • bookingStatus → "Completed"                        │
  │     • bukan "Confirmed" (itu punya approval booking)     │
  └──────────────────────────────────────────────────────────┘
```

**Syarat sebelum approval bisa mulai** (guard):
- Semua termin lunas (`status unearned`, gak ada `receivable`)
- `EventEvaluation` (dokumen) udah dibuat
- `WeddingIndicator` (rating client) udah terisi

MICE: skip client step (3-approve), sama kayak approval booking existing (`includeClientStep: false`).

---

## 9. Read Path — Semua Angka dari Ledger

```
  PIUTANG (AR)   = Σ ledger WHERE status = receivable
  UANG MASUK     = Σ ledger WHERE status = unearned (udah bayar, blm earned)
  PENDAPATAN     = Σ ledger WHERE status = earned
  BELUM DI-ACK   = Σ ledger WHERE entryType = cash_in AND ackStatus = pending
  CASHFLOW/period = Σ ledger WHERE entryType = cash_in GROUP BY occurredAt   ← uang RIIL doang
  TOTAL POTONGAN = Σ ledger WHERE entryType = discount                       ← beban promo
```

> **Penting:** cashflow bank cuma jumlahin `entryType = cash_in` (uang riil), JANGAN ikutin `discount`. Kalau `discount` keikut, angka cashflow gak akan match mutasi rekening. Piutang yang ketutup = `cash_in + discount`, tapi kas yang masuk = `cash_in` doang.

**Refactor query existing** (`lib/queries/finance.ts`, `lib/queries/ar.ts`, `lib/queries/groups.ts`):
- Sekarang: piutang dihitung dari `TOP.paymentStatus + ackStatus`.
- Nanti: piutang/unearned/earned dihitung dari `ledger.status`.
- **Isi 2 halaman placeholder:** AR Aging + AR Client (sekarang masih kosong "sedang disiapkan").

---

## 10. UI — Halaman Ledger (1 halaman, sesuai keputusan lo)

**`/dashboard/finance/ledger`** — mirror sheet `DATA` SAMISARA, semua dalam 1 halaman:

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │  Ledger — Buku Besar                    [filter periode] [export]    │
  ├─────────────────────────────────────────────────────────────────────┤
  │  KPI:  Piutang 35jt │ Unearned 15jt 🔵 │ Earned 0 🟢 │ Potongan 5jt 🏷│
  ├─────────────────────────────────────────────────────────────────────┤
  │  [ Semua ] [ Cash Masuk ] [ Unearned ] [ Earned ] [ Potongan ]  ← tab│
  ├─────────────────────────────────────────────────────────────────────┤
  │  Tanggal │ Client        │ Nominal │ Kwitansi │ Via     │ Status │Ack│
  │  02 Jan  │ RIDHO & TIARA │ 45jt    │ 905/...  │ BCA 149 │ 🔵 une │ ✅ │
  │  02 Jan  │ RIDHO & TIARA │  5jt 🏷 │ (promo)  │ —       │ 🔵 une │ — │
  │  05 Jan  │ AURA & ADI    │ 55jt    │ 929/...  │ BCA 149 │ 🔵 une │ ⏳ │
  └─────────────────────────────────────────────────────────────────────┘
```

Tab in-page (bukan sub-route) buat mecah view Unearned/Earned/Potongan. Card style Bank Jago (rounded-2xl, pill status, Solar icon) — sesuai design system. Baris `discount` ditandain badge 🏷 + "Via = —" (bukan uang riil).

---

## 11. Rencana Implementasi (Fase)

### 🟢 SEKARANG — FE-ONLY (yang kita kerjain)

**Fase A — Menu + Types + Dummy seed**
- [ ] `types/finance.ts` → tambah `LedgerEntry`, `LedgerStatus`, `LedgerEntryType`, `LedgerAckStatus`, `LedgerFilters` (TS interface, mirror AR/AP)
- [ ] `ledger-dummy.ts` → `SEED_LEDGER` array ~10-15 transaksi contoh (niru sheet DATA SAMISARA) + `DUMMY_PROMOS` (mock katalog promo)
- [ ] Menu "Ledger" di `sidebar-config.ts` (di atas Accounts Receivable) + `finance-nav-config.ts`, icon `Bill`

**Fase B — Halaman Ledger (1 halaman, client state)**
- [ ] `finance/ledger/page.tsx` — client component, `useState<LedgerEntry[]>(SEED_LEDGER)`
- [ ] KPI cards (`ledger-summary-cards.tsx`) — Piutang/Unearned/Earned/Potongan dari `useMemo`
- [ ] Tab in-page (Semua / Cash Masuk / Unearned / Earned / Potongan)
- [ ] `ledger-filter-bar.tsx` (search + periode) + `ledger-table.tsx` + pagination — niru `ap-*`
- [ ] `ledger-format.tsx` — badge status/entryType + `fmtRp`/`fmtDate` (niru `ap-format`)

**Fase C — Input & Nambah data (dummy interaktif)**
- [ ] `ledger-entry-drawer.tsx` — form "Catat Transaksi": pilih booking/client (dummy), nominal, tanggal, via, kwitansi, + pilih promo
- [ ] Submit → **append** row ke state (`setLedger([...prev, row])`) — TANPA server action, TANPA toast-only. Row baru langsung muncul di tabel.
- [ ] Kalau pilih promo → hitung potongan di client → append **2 row** (`cash_in` + `discount`)
- [ ] Tombol ack (pura-pura): klik → update `ackStatus` row di state jadi `acknowledged`
- [ ] Tombol recognize/undo (pura-pura): flip status row unearned↔earned di state

> **Selesai Fase C = UI utuh yang bisa lo klik-klik & isi data.** Baru minta acc lo, terus lanjut BE.

---

### 🔒 NANTI — BACKEND (setelah UI di-acc, JANGAN sekarang)

<details>
<summary>Fase BE (referensi, di-skip dulu)</summary>

- **BE-1 Skema & Migration:** `CashflowLedger` + 3 enum, pindah `ackStatus` dari TOP → ledger, relasi balik 6 model, migration idempotent + backfill (sampai unearned), seed permission `ledger`, enum `bookingStatus += Completed`
- **BE-2 Read path:** `lib/queries/ledger.ts` (piutang/unearned/earned), ganti dummy → query real
- **BE-3 Posting engine:** `lib/ledger.ts` (`openLedgerOnSigning`, `postCashIn`, `postDiscount`, `ackCashIn`, `recognizeRevenue`, `undoRecognition`, `postAdjustment`), wire ke `sign/route.ts` + `partial-payment.ts` + `payment-ack.ts`, idempotency guard
- **BE-4 Promo real:** nyalain `{false && ...}` di `edit-top-drawer.tsx:544`, ganti `DUMMY_PROMOS` → `/api/promos`, validasi apply, `usedCount++`
- **BE-5 Recognition:** approval module `event-completion`, syarat `EventEvaluation` + `WeddingIndicator`, override + undo Finance
- **BE-6 Refactor & cleanup:** alihkan `finance.ts`/`ar.ts`/`groups.ts` ke ledger, isi AR Aging + Client, drop `Booking.paymentStatus`, update AGENTS.md §5

</details>

---

## 12. Risiko & Mitigasi

> 🔒 **Semua risiko di bawah = fase BACKEND.** Buat FE-first, risikonya cuma "dummy state ilang pas refresh" — dan itu emang disengaja (pura-pura). Tabel ini disimpen buat pas naik ke BE.

| Sev | Risiko | Mitigasi |
|---|---|---|
| 🔴 | **Pindah ackStatus dari TOP breaking** — dipakai di `finance.ts`, `ar.ts`, `groups.ts`, `payment-ack.ts`, UI drawer | Migration bertahap: (1) bikin ledger + backfill ack, (2) alihkan reader ke ledger, (3) baru drop field TOP. Jangan drop sebelum reader dialihkan. |
| 🔴 | **Double-posting** (signing keret 2x, ack race) | Unique constraint `(bookingId, termId, entryType)` utk receivable; `(partialPaymentId)` utk cash_in; atomic claim pattern kayak sign route existing. |
| 🟡 | **Recognition tapi masih ada piutang** (acara jalan, client belum lunas) | Business rule: butuh approval Finance eksplisit ATAU blok recognition sampai lunas. Tanya user (§13). |
| 🟡 | **Backfill data lama** — booking existing gak punya ledger | Script backfill: generate receivable dari TOP + cash_in dari PartialPayment + earned utk booking yang eventDate udah lewat. |
| 🟡 | **MICE tanpa client step** | Recognition MICE = 3-approve, parametris (`includeClientStep: false`) — pola udah ada. |

---

## 13. Keputusan yang Udah Diambil (dari diskusi user)

| # | Topik | Keputusan |
|---|---|---|
| 1 | **Recognition guard** | Boleh flip ke earned **walau piutang belum lunas**, ASAL Finance approve eksplisit. Finance juga bisa **undo** (earned → unearned) sewaktu-waktu. → §6.3 |
| 2 | **Backfill data lama** | Booking lama (eventDate udah lewat) → backfill **sampai unearned aja**. TIDAK auto-earned. Recognition tetep lewat approval manual. |
| 3 | **`Booking.paymentStatus`** | **Drop di Fase 5** setelah reader dialihkan ke ledger. |
| 4 | **Menu Ledger** | **1 halaman** yang nge-cover semua (Semua Transaksi + KPI Piutang/Unearned/Earned di atasnya). Gak dipecah jadi sub-halaman. |
| 5 | **Promo/discount** | Diaktifkan. Promo **per pembayaran**, basis potongan = **nominal dibayar** (bukan harga paket), nutup piutang tanpa jadi uang riil (contra-receivable, 2 baris). → §6.5 |

**Masih perlu diputuskan belakangan (gak blocking FE):**
- **Refund** (client batal/lebih bayar) — ditunda, dibahas bareng AP.
- Detail teknis event-completion approval (siapa role sales/manager/finance persisnya) — pas fase BE-5.

---

## 14. Blueprint FE — Simulasi Dummy (yang dibangun SEKARANG)

Ini spesifik buat scope FE-first. Semua di **client state**, gak ada Prisma/action.

### 14.1. TS interface (di `types/finance.ts`, mirror pola AR/AP existing)

```ts
export type LedgerStatus    = "receivable" | "unearned" | "earned" | "void";
export type LedgerEntryType = "receivable" | "cash_in" | "discount" | "recognition" | "adjustment" | "refund";
export type LedgerAckStatus = "pending" | "acknowledged" | "rejected";

export interface LedgerEntry {
  id: string;
  occurredAt: string;          // "2026-01-02"
  bookingId: string;
  clientName: string;          // buat display (dummy udah denormalized)
  entryType: LedgerEntryType;
  status: LedgerStatus;
  amount: number;
  ackStatus: LedgerAckStatus;
  acknowledgedBy: string | null;   // "PENANDA TANGAN"
  paymentMethod: string | null;    // "BCA 149" — null utk baris discount
  invoiceNumber: string | null;    // no kwitansi
  discountProgramName: string | null; // keisi kalau entryType=discount
  notes: string | null;
}

export interface LedgerFilters {
  status?: LedgerStatus;
  entryType?: LedgerEntryType;
  search?: string;
  dateRange?: { from?: string; to?: string };
}
```

### 14.2. Cara "nambah data" (inti request lo)

Beda dari AP yang dummy-nya `const` mati, Ledger dummy ditaruh di **state** biar bisa tambah:

```tsx
// finance/ledger/page.tsx  (client component)
const [ledger, setLedger] = useState<LedgerEntry[]>(SEED_LEDGER);

// KPI turunan — otomatis keitung ulang tiap state berubah
const kpi = useMemo(() => ({
  piutang:  sum(ledger, e => e.status === "receivable"),
  unearned: sum(ledger, e => e.status === "unearned"),
  earned:   sum(ledger, e => e.status === "earned"),
  potongan: sum(ledger, e => e.entryType === "discount"),
}), [ledger]);
```

### 14.3. Submit drawer — append (dengan/ tanpa promo)

```ts
function handleRecord(input) {
  const bayar = input.amount;
  const rows: LedgerEntry[] = [];

  // baris cash_in (uang riil)
  rows.push(mkRow({ entryType: "cash_in", status: "unearned", amount: bayar, ... }));

  // kalau ada promo → baris discount (contra-receivable, bukan uang riil)
  if (input.promo) {
    const potongan = input.promo.type === "PERCENTAGE"
      ? Math.round(bayar * input.promo.value / 100)   // basis = nominal DIBAYAR
      : input.promo.value;
    rows.push(mkRow({
      entryType: "discount", status: "unearned", amount: potongan,
      paymentMethod: null, discountProgramName: input.promo.name, ...
    }));
  }

  setLedger(prev => [...prev, ...rows]);   // ← row langsung nongol di tabel
}
```

> **ID unik tanpa `Date.now()`/`Math.random()`** (dilarang di beberapa konteks): pakai counter `useRef` atau `crypto.randomUUID()` di event handler (aman, bukan render).

### 14.4. Ack / Recognize / Undo — mutasi status di state

```ts
const ack       = (id) => setLedger(p => p.map(e => e.id === id ? { ...e, ackStatus: "acknowledged", acknowledgedBy: "Rosita" } : e));
const recognize = (id) => setLedger(p => p.map(e => e.id === id && e.status === "unearned" ? { ...e, status: "earned" } : e));
const undo      = (id) => setLedger(p => p.map(e => e.id === id && e.status === "earned"   ? { ...e, status: "unearned" } : e));
```

### 14.5. Design system (wajib patuh)
- Card `rounded-2xl`, tabel `rounded-2xl border`, pill/chip `rounded-full` — Bank Jago vibe (niru `ap-table.tsx`).
- Warna cuma token (`text-foreground`, `text-muted-foreground`, `bg-primary`, `bg-secondary`, `destructive`) + brand var. **Gak ada hex/warna mentah.**
- Icon Solar `weight="BoldDuotone"` (mis. `Bill`, `CardReceive`, `TagPrice`, `HandMoney`).
- Tailwind v4 syntax (`data-attr:class`, important suffix `class!`).
- ESLint: side-effect pake `if/else`, ternary cuma buat value.

---

*Design plan ini FE-first. Scope SEKARANG = §14 (UI + dummy interaktif), TANPA backend/migration. Section 5–8 = referensi BE buat nanti. Semua flow mengacu ke kondisi codebase nyata (scout 2026-07-11) + preseden modul AP (FE-only) + validasi Excel SAMISARA. Keputusan §13 udah final.*
