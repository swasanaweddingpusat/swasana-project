# Design Plan — Cashflow Ledger (Buku Besar) & Deferred Revenue

> **Status:** DRAFT — design only, belum ada kode.
> **Author:** brodi session, 2026-07-10
> **Branch target:** `feat/crm` (atau branch baru `feat/ledger`)
> **Scope:** Buku besar cash-in/out yang nyambung ke Booking → Term of Payment → Snapshot/Revision → Approval, dengan konsep **Deferred Revenue** (pendapatan diterima dimuka).

---

## 0. TL;DR

Bikin **general ledger append-only** (`CashflowLedger`) yang mencatat tiap peristiwa finansial sebuah booking. Konsep intinya **Deferred Revenue**:

- **Uang masuk ≠ pendapatan.** Client bayar sebelum event = lo berutang jasa ke client → saldo **KREDIT** (liabilitas), bukan pendapatan.
- **Ledger baru kebuka pas CLIENT TTD (signing).** Sebelum itu booking bebas edit, ga ada jejak finansial (sesuai instinct: belum ada kontrak mengikat = belum ada kewajiban).
- **Flip KREDIT → DEBIT (unearned → earned) pas EVENT SELESAI + 4-approval** (sales, manager, finance, client).
- **`promoId` + `promoSnapshot` di Booking DI-DROP.** Program diskon bukan properti booking — dia peristiwa finansial. Nilai diskon di-**snapshot sebagai baris ledger** pas signing, bukan sebagai field di Booking.
- **Revisi = append delta entry, BUKAN edit/hapus.** Tiap revisi kelacak, jejak audit utuh.

---

## 1. Latar Belakang & Konsep Akuntansi

### 1.1. Masalah yang dipecahkan

Bisnis event: client bayar **jauh sebelum** jasa diberikan (DP saat booking, pelunasan mendekati hari-H). Secara akuntansi yang benar:

```
Uang masuk ke rekening  ≠  Uang itu sudah jadi PENDAPATAN

Kenapa? Jasa belum diberikan (event belum jalan).
Kalau client cancel → uang harus dikembalikan.
→ Uang itu masih UTANG perusahaan ke client = LIABILITAS = saldo KREDIT.
```

Uang baru jadi **pendapatan nyata (earned revenue)** setelah:
1. Event selesai dilaksanakan, DAN
2. Di-approve oleh 4 pihak (sales, manager, finance, client).

Ini disebut **Deferred Revenue** / **Unearned Revenue** (Pendapatan Diterima Dimuka).

### 1.2. Istilah (glossary)

| Istilah | Arti di project ini |
|---|---|
| **Deferred / Unearned Revenue** | Cash sudah diterima, tapi jasa belum diberikan. Saldo **kredit** (liabilitas). |
| **Earned Revenue** | Pendapatan nyata setelah event selesai + approve. Saldo **debit** (revenue recognized). |
| **Revenue Recognition** | Momen flip `unearned → earned`. Trigger: event selesai + 4-approval. |
| **Contra-revenue (discount)** | Diskon program. Mengurangi nilai kontrak. Bukan cash keluar (asumsi: potong harga). |
| **Piutang (AR)** | Nilai kontrak yang sudah diteken tapi belum dibayar. `net kontrak − total cash_in`. |
| **Append-only ledger** | Baris ledger tidak pernah di-edit/hapus. Koreksi = baris baru (delta/adjustment). |

### 1.3. Asumsi yang dipakai (WAJIB dikonfirmasi sebelum implement)

> ⚠️ **3 keputusan yang harus user konfirmasi. Default di bawah ini adalah asumsi paling umum.**

1. **Diskon = potong harga (price reduction), BUKAN cashback.**
   Client cuma bayar total **net** (mis. 45jt), bukan bayar 50jt penuh lalu dikembalikan 5jt.
   → Termin dijumlahkan = net. Diskon = contra-revenue, **tidak ada cash keluar**.

2. **Ledger kebuka pas SIGNING (client TTD).**
   Saat signing: catat *rencana* kontrak (net + diskon) sebagai baris ledger, cash belum tentu masuk.
   Tiap pembayaran termin → tambah baris `cash_in`.

3. **Piutang (AR) dilacak sebagai turunan (computed), bukan baris ledger tersendiri.**
   AR = `SUM(kontrak net) − SUM(cash_in)`. Ga perlu entry khusus, cukup query.

---

## 2. Timeline Finansial (Business Flow)

```
  CREATE booking       SIGN (client TTD)      BAYAR termin        EVENT SELESAI
  ────────────         ─────────────────      ────────────        + 4 APPROVE
       │                      │                     │                   │
       ▼                      ▼                     ▼                   ▼
  ❌ BELUM masuk         🔓 LEDGER DIBUKA      💰 CASH IN         🔄 UNEARNED→EARNED
  ledger                 • diskon di-stamp     • entryType:       • sales    ✅
                         • termin jadi           cash_in          • manager  ✅
  Bebas edit,            • snapshotFrozenAt     • account:        • finance  ✅
  NO approval ulang        keset (existing)      deferred_revenue • client   ✅
  (belum ada kontrak)    • entry kontrak+       • status:              │
                           diskon dibuat         unearned              ▼
                                                • saldo KREDIT   ✅ REVENUE RECOGNIZED
                                                                 semua entry booking
                                                                 flip → earned (DEBIT)
```

### 2.1. Momen kunci: SIGNING mengunci 2 hal sekaligus

`snapshotFrozenAt` (yang **sudah ada** di codebase) diset saat signing. Momen ini kita perluas jadi mengunci **dua** hal:

1. **Snapshot layer beku** (existing behavior) — SnapCustomer/pricing/internal items immutable.
2. **Ledger kebuka** (baru) — baris kontrak + diskon dicatat, cash-in mulai bisa masuk.

Satu event, dua efek. Elegan & konsisten sama arsitektur existing.

---

## 3. Skema Data

### 3.1. Model baru: `CashflowLedger`

```prisma
model CashflowLedger {
  id              String            @id @default(uuid())

  // ── Keterkaitan ke domain ──
  bookingId       String
  revisionId      String?           // revisi mana yang memicu entry ini (audit trail per revisi)
  termId          String?           // termin mana (untuk cash_in per termin)

  // ── Klasifikasi akuntansi ──
  entryType       LedgerEntryType   // cash_in | cash_out | discount | revenue_recognized | refund | adjustment
  account         LedgerAccount     // cash_bank | deferred_revenue | earned_revenue | discount | receivable
  status          LedgerStatus      @default(unearned) // unearned | earned | void

  // ── Nominal ──
  amount          Int               // dalam rupiah penuh (Int, konsisten dgn TermOfPayment.amount)
  direction       LedgerDirection   // debit | credit

  // ── Referensi tambahan ──
  paymentMethodId String?           // bank tujuan (reuse PaymentMethod, sudah ada di TOP)
  programId       String?           // kalau entryType=discount, program mana (reuse DiscountProgram)
  programSnapshot Json?             // snapshot aturan program pada saat stamping (immutable)

  // ── Waktu ──
  occurredAt      DateTime          // kapan uang benar-benar bergerak / peristiwa terjadi
  recognizedAt    DateTime?         // kapan flip ke earned (null selama unearned)

  // ── Metadata ──
  createdBy       String?           // profiles.id
  notes           String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  booking         Booking           @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  revision        BookingRevision?  @relation(fields: [revisionId], references: [id], onDelete: SetNull)
  term            TermOfPayment?    @relation(fields: [termId], references: [id], onDelete: SetNull)
  paymentMethod   PaymentMethod?    @relation(fields: [paymentMethodId], references: [id], onDelete: SetNull)
  program         DiscountProgram?  @relation(fields: [programId], references: [id], onDelete: SetNull)
  creator         Profile?          @relation(fields: [createdBy], references: [id], onDelete: SetNull)

  @@index([bookingId])
  @@index([revisionId])
  @@index([termId])
  @@index([entryType])
  @@index([status])
  @@index([occurredAt])
  @@index([bookingId, status])
  @@map("cashflow_ledgers")
}
```

### 3.2. Enum baru

```prisma
enum LedgerEntryType {
  cash_in              // uang masuk (pembayaran termin)
  cash_out             // uang keluar (biaya vendor, refund ke client)
  discount             // potongan program (contra-revenue)
  revenue_recognized   // penanda flip unearned → earned
  refund               // pengembalian ke client
  adjustment           // koreksi delta akibat revisi (append, bukan edit)
}

enum LedgerAccount {
  cash_bank            // kas / bank
  deferred_revenue     // pendapatan diterima dimuka (liabilitas, kredit)
  earned_revenue       // pendapatan nyata (debit)
  discount             // kontra-pendapatan
  receivable           // piutang (opsional, kalau AR mau eksplisit)
}

enum LedgerStatus {
  unearned             // masih deferred (kredit)
  earned               // sudah recognized (debit)
  void                 // dibatalkan (untuk koreksi non-destructive)
}

enum LedgerDirection {
  debit
  credit
}
```

### 3.3. Perubahan pada model existing

**`Booking` — DROP 2 field:**

```diff
- promoId               String?
- promoSnapshot         Json?                // snapshot of DiscountProgram at booking creation
- promo                 DiscountProgram?     @relation(fields: [promoId], references: [id], onDelete: SetNull)
- @@index([promoId])
```

> **Catatan penting:** `discountName` + `discountAmount` di Booking → **pertimbangkan tetap dipertahankan** sebagai denormalisasi display cepat (dipakai di PO render & table). Tapi *source of truth* pindah ke ledger entry `discount`. Keputusan: **keep untuk display, ledger untuk truth** (lihat §6 Risiko).

**`DiscountProgram`** — tetap sebagai master (aturan diskon). Relasi `bookings Booking[]` diganti jadi `ledgerEntries CashflowLedger[]`.

**`BookingRevision`, `TermOfPayment`, `PaymentMethod`, `Profile`** — tambah relasi balik `ledgerEntries CashflowLedger[]`.

---

## 4. Aturan Pencatatan (Posting Rules)

### 4.1. Saat SIGNING (client TTD) — dalam `$transaction` yang sama dgn `snapshotFrozenAt`

Reuse: `app/api/client-agreement/sign/route.ts` (sudah pakai `$transaction` array + `logAudit`).

Entry yang dibuat:

| # | entryType | account | direction | status | amount | Keterangan |
|---|---|---|---|---|---|---|
| 1 | `discount` | `discount` | debit | unearned | 5jt | kalau ada program diskon; `programSnapshot` diisi |
| — | (kontrak net dicatat implisit via termin, ATAU 1 entry summary net) | | | | | lihat opsi di §4.4 |

> Cash belum masuk di momen ini (kecuali DP dibayar barengan). Signing = **komitmen kontrak**, bukan cash.

### 4.2. Saat BAYAR termin (Finance ack pembayaran)

Reuse: `actions/payment-ack.ts` / `actions/partial-payment.ts`.

| entryType | account | direction | status | amount |
|---|---|---|---|---|
| `cash_in` | `deferred_revenue` | credit | unearned | nominal termin yg dibayar |
| `cash_in` | `cash_bank` | debit | — | nominal termin yg dibayar |

> Ini bentuk **double-entry ringan**: cash bertambah (debit cash_bank) diimbangi liabilitas deferred revenue bertambah (credit). Kalau ga mau double-entry, cukup 1 baris `cash_in / deferred_revenue / credit`.

### 4.3. Saat EVENT SELESAI + 4-APPROVE — Revenue Recognition

Reuse: `ApprovalRecord` + `ApprovalRecordStep` engine (module baru: `event-completion`).

Ketika approval `event-completion` lengkap (sales→manager→finance→client):

```
Untuk semua entry booking dgn status = unearned:
  → set status = earned
  → set recognizedAt = now()
  → buat 1 entry penanda: revenue_recognized / earned_revenue / debit / earned
```

### 4.4. Revisi booking — APPEND delta, jangan edit

Contoh: client teken 45jt, bayar DP 15jt. Material change → kontrak jadi 50jt.

```
Entry #1  [rev-1] discount    debit  5jt   unearned  (beku)
Entry #2  [rev-1] cash_in     credit 15jt  unearned  (beku)
Entry #3  [rev-2] adjustment  credit 5jt   unearned  ← revisi nambah kontrak, BUKAN nimpa
─────────────────────────────────────────────────
Posisi = SUM semua entry aktif (status != void)
       = kontrak net 50jt, kebayar 15jt, piutang 35jt
```

**Aturan revisi:**
- Entry lama **tidak** di-edit/hapus (append-only, jejak audit utuh).
- Revisi yang mengubah nilai → entry `adjustment` baru dengan `revisionId` = revisi baru.
- Kalau perlu batalkan entry (mis. salah input), pakai `status = void` + entry pembalik, **jangan DELETE**.

---

## 5. Integrasi ke Kode Existing (Reuse, jangan bikin baru)

| Kebutuhan | Reuse yang sudah ada | File |
|---|---|---|
| Ledger kebuka pas signing | `$transaction` + `snapshotFrozenAt` set | `app/api/client-agreement/sign/route.ts` |
| Cash-in pas bayar | ack & partial payment flow | `actions/payment-ack.ts`, `actions/partial-payment.ts`, `actions/term-of-payment.ts` |
| Revenue recognition 4-approve | `ApprovalRecord` engine, module `event-completion` | `actions/booking.ts` approval helpers, `lib/` |
| Diskon master | `DiscountProgram` + `DiscountType` enum | `actions/promo.ts`, `app/(private)/dashboard/discount-promo/` |
| Finance summary/AR | extend existing finance queries | `lib/queries/finance.ts`, `lib/queries/booking-finance-detail.ts` |
| Audit | `logAudit()` tiap posting | `lib/audit.ts` |
| Rate limit + permission | `mutationLimiter`, `requirePermission` | per AGENTS.md §4 |

**Permission module baru** (tambah ke seed & AGENTS.md §5):
- `ledger` → `view`, `export`
- `event-completion` → `view`, `approve`, `reject`

---

## 6. Risiko & Mitigasi

| Sev | Risiko | Mitigasi |
|---|---|---|
| 🔴 | **Drop `promoId`/`promoSnapshot` breaking** — kepakai di ~15 file (booking-draft, revision, render-po, dll) | Migration bertahap: (1) bikin ledger + backfill dari `promoSnapshot` existing, (2) alihkan read ke ledger, (3) baru drop kolom. Jangan drop sebelum semua reader dialihkan. |
| 🔴 | **Double-posting** (signing keret 2x, ack race) | Guard idempotent: unique constraint `(bookingId, revisionId, entryType, termId)` untuk entry yang harusnya sekali; atomic claim pattern spt sign route existing. |
| 🔴 | **Ledger vs `discountAmount` desync** | Tetapkan ledger sbg source of truth. `Booking.discountAmount` cuma display cache, di-recompute dari ledger, jangan jadi acuan finance. |
| 🟡 | **Revisi setelah recognition** (event udah earned, tapi ada koreksi) | Entry `adjustment` dengan status sendiri; recognition entry immutable. Butuh aturan: revisi post-recognition harus approval finance. |
| 🟡 | **Refund lintas booking** (`BookingPaymentSettlement` udah ada) | Sambungkan settlement ke ledger `refund`/`cash_out` entry, jangan bikin jalur cash kedua yang terpisah. |
| 🟡 | **MICE belum punya client step** | Recognition MICE = 3-approve (sales→manager→finance), skip client. Parameterisasi seperti approval existing (`includeClientStep`). |

---

## 7. Rencana Implementasi (Fase)

### Fase 0 — Konfirmasi & Desain (SEKARANG)
- [ ] User konfirmasi 3 asumsi di §1.3 (diskon potong-harga? ledger buka pas signing? AR computed?)
- [ ] Finalisasi skema `CashflowLedger` + enum
- [ ] Sepakati apakah pakai double-entry ringan (2 baris) atau single-entry (1 baris)

### Fase 1 — Skema & Migration (non-breaking)
- [ ] Tambah model `CashflowLedger` + 4 enum ke `schema.prisma`
- [ ] Tambah relasi balik di Booking/Revision/TOP/PaymentMethod/Profile/DiscountProgram
- [ ] Migration idempotent (`CREATE TABLE IF NOT EXISTS`, dst — per AGENTS.md §6)
- [ ] **JANGAN drop `promoId` dulu** — coexist dulu
- [ ] Seed permission `ledger` + `event-completion`

### Fase 2 — Posting Engine (write path)
- [ ] `lib/ledger.ts` — helper posting: `postSigningEntries()`, `postCashIn()`, `recognizeRevenue()`, `postAdjustment()`, semua array-`$transaction` friendly
- [ ] Wire ke signing route (entry diskon + kontrak, dalam txn yg sama dgn freeze)
- [ ] Wire ke payment ack (cash_in)
- [ ] Idempotency guard (unique constraint)
- [ ] `logAudit` tiap posting

### Fase 3 — Revenue Recognition
- [ ] Approval instance `event-completion` (reuse engine, 4-step / 3-step MICE)
- [ ] Trigger flip `unearned → earned` saat approval lengkap
- [ ] Guard: cegah recognition kalau piutang belum lunas (opsional, business rule)

### Fase 4 — Read path & UI (Buku Besar)
- [ ] `lib/queries/ledger.ts` — posisi per booking, saldo deferred vs earned, piutang, cashflow period
- [ ] UI `app/(private)/dashboard/finance/` (extend existing) atau folder `ledger/` baru
- [ ] Laporan: cash-in/out per periode, deferred revenue outstanding, AR aging

### Fase 5 — Migrasi promo & cleanup
- [ ] Backfill ledger `discount` entry dari `promoSnapshot` existing bookings
- [ ] Alihkan semua reader promo → ledger
- [ ] Baru DROP `promoId` + `promoSnapshot` (migration terpisah, setelah verifikasi)
- [ ] Update AGENTS.md §5 (permission) + dokumentasi

---

## 8. Diagram Skema (ringkas)

```
  DiscountProgram (master aturan)
        │ programId (+ programSnapshot beku)
        ▼
  ┌─────────────────────────────────────────────┐
  │            CashflowLedger (append-only)       │
  │  bookingId ──▶ Booking                        │
  │  revisionId ─▶ BookingRevision (audit/revisi) │
  │  termId ─────▶ TermOfPayment (cash per termin)│
  │  paymentMethodId ▶ PaymentMethod (bank)       │
  │                                               │
  │  entryType · account · direction · status     │
  │  amount · occurredAt · recognizedAt           │
  └─────────────────────────────────────────────┘
        │
        │ status: unearned ──(event done + 4 approve)──▶ earned
        ▼
  Posisi finansial = SUM(entry WHERE status != void)
     • Kontrak net   = SUM(discount adj + adjustment)
     • Cash masuk    = SUM(cash_in)
     • Piutang (AR)  = kontrak net − cash masuk
     • Deferred      = SUM(unearned credit)
     • Earned        = SUM(earned)
```

---

## 9. Pertanyaan Terbuka (perlu jawaban user)

1. **Diskon**: potong harga atau cashback? (default asumsi: potong harga)
2. **Ledger buka**: pas signing atau pas cash pertama masuk? (default: signing)
3. **Piutang (AR)**: computed atau baris ledger eksplisit? (default: computed)
4. **Double-entry vs single-entry**: mau tiap cash-in 2 baris (cash_bank + deferred) atau cukup 1 baris? (default rekomendasi: single-entry dulu, upgrade nanti)
5. **Recognition guard**: boleh recognize revenue kalau piutang belum lunas? (mis. event jalan tapi client belum lunas — earned tapi AR masih ada)
6. **"Master data program + ketentuannya"** yang lo bilang udah dibikin — apakah maksudnya `DiscountProgram` yang existing, atau ada spec/tabel lain? Perlu gue lihat ketentuannya biar posting rule diskon akurat.

---

*Design plan ini murni desain. Belum ada satu baris kode pun ditulis. Semua angka & flow di atas mengacu ke asumsi §1.3 yang WAJIB dikonfirmasi sebelum Fase 1.*
