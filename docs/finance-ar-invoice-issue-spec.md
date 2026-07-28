# Spec — Terbitkan Invoice (Finance AR)

> **Status kode:** issue + void invoice **sudah berfungsi** (backend + UI create terpasang). Void masih backend-only (belum ada tombol di UI). PDF/preview invoice masih orphaned.
> **Modul:** `finance-ar` · **Cakupan:** Accounts Receivable → per-termin.
> **Sumber verifikasi:** `actions/invoice.ts`, `lib/validations/invoice.ts`, `prisma/schema.prisma`, `hooks/use-invoices.ts`, `services/invoice-service.ts`, `app/(private)/dashboard/finance/accounts-receivable/_components/IssueInvoiceDrawer.tsx` + `ar-table.tsx`.

---

## 1. Konsep — Invoice ≠ Kwitansi

Dua dokumen keuangan yang beda peran dan **tidak boleh ketuker**:

| Aspek | **Invoice** (tagihan) | **Kwitansi** (bukti bayar) |
|---|---|---|
| Arti | "Tolong bayar sekian" | "Sudah terima sekian" |
| Dipicu oleh | Finance klik **Terbitkan Invoice** | Cash-in masuk (Ledger) |
| Nomor | `/INV/` bulan **Romawi** | `/KW/` bulan **angka** |
| Sumber angka | `TermOfPayment.amount` (net, dibekukan) | `Ledger.amount` (cash aktual) |
| Tabel | `Invoice` (entity terpisah) | `Ledger.invoiceNumber` |

Prinsip kunci: **1 invoice = 1 termin**, on-demand, nomor gapless, `amount` **beku** saat terbit (bukan dibaca live dari termin lagi), pembatalan lewat **tombstone** (row tak pernah dihapus).

---

## 2. Data Model (ERD)

```mermaid
erDiagram
    Booking ||--o{ TermOfPayment : "punya jadwal"
    Booking ||--o{ Invoice : "punya tagihan"
    TermOfPayment ||--o| Invoice : "0..1 invoice aktif"
    Profile ||--o{ Invoice : "issuedBy / voidedBy"

    Invoice {
        string  id PK
        string  bookingId FK
        string  termId FK "nullable — SetNull saat termin dihapus"
        string  invoiceNumber UK "gapless, unik"
        enum    invoiceType "dp|progress|pelunasan|lainnya"
        int     amount "BEKU (net) saat terbit"
        date    dueDate "nullable"
        string  notes "nullable, max 500"
        enum    status "issued|void"
        date    issuedAt
        string  issuedById FK
        date    voidedAt "nullable"
        string  voidedById FK
    }
```

**Kenapa `termId` nullable?** Kalau termin di-rebuild/dihapus (mis. switch venue), invoice yang sudah terbit tetap utuh sebagai dokumen historis — jadi "yatim" tapi tidak rusak (`onDelete: SetNull`).

---

## 3. State Machine Invoice

```mermaid
stateDiagram-v2
    [*] --> BelumDitagih : termin dibuat
    BelumDitagih --> Issued : Terbitkan Invoice
    Issued --> Void : Void (tombstone)
    Void --> Issued : re-issue (nomor BARU)
    Void --> [*]

    note right of Issued
        amount beku
        tombol terbit hilang
        badge biru bernomor
    end note
    note right of Void
        badge strikethrough
        nomor tak dipakai ulang
    end note
```

- 1 termin cuma boleh punya **1 invoice `issued`** dalam satu waktu (di-guard di server).
- Mau ganti invoice? **Void dulu** yang lama → baru bisa terbit lagi (dapat nomor baru, nomor lama hangus).

---

## 4. Alur End-to-End (Sequence)

```mermaid
sequenceDiagram
    actor U as Finance User
    participant T as ar-table.tsx
    participant D as IssueInvoiceDrawer
    participant H as useIssueInvoice (hook)
    participant S as issueInvoice (server action)
    participant DB as Postgres (Neon)

    U->>T: Klik ikon "Terbitkan Invoice" (baris termin)
    T->>D: buka drawer (termId, amount, dueDate)
    U->>D: pilih jenis + due date + catatan → Submit
    D->>H: mutate(input)
    H->>S: issueInvoiceClient(input)

    S->>S: 1. requirePermission(finance-ar:create)
    S->>S: 2. mutationLimiter.check(invoice-issue:userId)
    S->>S: 3. issueInvoiceSchema.safeParse
    S->>DB: 4. fetch termin + venue.code
    S->>DB: 5. guard — invoice issued sudah ada?
    S->>DB: 6. getNextSequence(invoice-<year>) → nomor gapless
    S->>DB: 7. $transaction([ invoice.create ])
    S->>DB: 8. logAudit(invoice.issued)
    S->>S: 9. revalidateTag(ar-bookings + invoices)
    S-->>H: { id, invoiceNumber }
    H-->>D: onSuccess
    D->>U: toast "Invoice <nomor> berhasil diterbitkan"
    D->>T: invalidate ["ar-bookings"] → tabel refetch
    T->>U: badge biru bernomor, tombol terbit hilang
```

Urutan server action ini **persis** mengikuti aturan hardened project: permission → rate-limit → Zod → transaksi array-form → audit → revalidate.

---

## 5. Format Penomoran

```
<seq>/INV/<kodeVenue>/<bulanRomawi>/<tahun>
```

Contoh: **`7/INV/SWS/VII/2026`**

- `seq` — dari `getNextSequence("invoice-<year>")` → UPSERT atomik `counters`, **gapless**, tanpa race.
- Bulan **Romawi** (`I`–`XII`) — pembeda utama dari kwitansi (angka).
- Counter dilanjut dari mint lama (sebelum FIX C) → sequence tak pernah reset lintas cara-mint.

---

## 6. UI States (per baris termin di AR)

```mermaid
flowchart TD
    A[Baris termin di AR] --> B{Punya invoice?}
    B -- Tidak --> C[Badge: Belum Ditagih -- abu-abu]
    C --> C2[Aksi: ikon AddSquare 'Terbitkan Invoice']
    B -- status=issued --> D[Badge biru bernomor]
    D --> D2[Aksi: — 'kosong']
    B -- status=void --> E[Badge strikethrough bernomor]
    E --> E2[Aksi: ikon AddSquare 'bisa terbit lagi']
```

| Kondisi | Kolom Invoice | Kolom Aksi |
|---|---|---|
| Belum ada invoice | `Belum Ditagih` (abu) | Tombol **Terbitkan Invoice** |
| `issued` | Badge **biru** + nomor | `—` (kosong) |
| `void` | Badge **strikethrough** + nomor | Tombol Terbitkan lagi |

---

## 7. Kontrak Data & Validasi

**Input form (`issueInvoiceSchema`, `lib/validations/invoice.ts`):**

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `termId` | string | ✅ | min 1 |
| `invoiceType` | enum | ✅ | `dp` \| `progress` \| `pelunasan` \| `lainnya` |
| `dueDate` | date | ❌ | opsional |
| `notes` | string | ❌ | max 500 char |

**Yang TIDAK dikirim client:** nomor invoice & amount — keduanya lahir/dibekukan **di server** (nomor via counter, amount = snapshot `termin.amount`). Ini mencegah tamper.

**Guard server (`issueInvoice`):**
1. `requirePermission("finance-ar", "create")`
2. `mutationLimiter` per user
3. Termin harus ada
4. Tolak kalau termin sudah punya invoice `issued`

**Guard server (`voidInvoice`):** `finance-ar:delete` + hanya invoice `issued` yang bisa di-void.

---

## 8. Status Implementasi

```mermaid
flowchart LR
    subgraph DONE["✅ Sudah jalan"]
      I1[Issue invoice create]
      I2[Guard 1 termin = 1 invoice aktif]
      I3[Penomoran gapless]
      I4[Audit trail]
      I5[Badge issued / void di tabel]
    end
    subgraph GAP["⚠️ Gap"]
      G1[Void invoice: backend+hook siap, tombol UI belum]
      G2[PDF/preview: InvoicePreviewDrawer orphaned + dummy 'SAMISARA']
      G3[Recognize Revenue: masih PREVIEW/dummy client-side]
    end
```

| Bagian | Status | Bukti |
|---|---|---|
| Terbitkan invoice (create) | ✅ Fully functional | `actions/invoice.ts:45` + drawer + hook nyambung |
| Guard duplikat | ✅ | `db.invoice.findFirst({ status:"issued" })` |
| Penomoran gapless | ✅ | `lib/counter.ts` UPSERT atomik |
| Audit | ✅ | `logAudit("invoice.issued")` |
| **Void di UI** | ⚠️ Backend+hook ada, tombol belum di-wire | `voidInvoice`, `useVoidInvoice` tanpa consumer di tabel |
| **PDF invoice** | ⚠️ Orphaned + dummy | `invoice-preview-drawer.tsx` zero-import, `ORG_NAME="SAMISARA"` |
| Recognize Revenue | 🚧 Preview/dummy | badge "PREVIEW", state client-only |

---

## 9. Rekomendasi Next Steps

1. **Wire tombol Void** di `ar-table.tsx` → panggil `useVoidInvoice` (backend sudah siap, tinggal UI + konfirmasi).
2. **Connect InvoicePreviewDrawer** ke tombol "Lihat/Cetak Invoice" pada baris `issued`, ganti dummy `ORG_NAME`/data org dengan data venue dari DB.
3. (Opsional) Realisasikan **Recognize Revenue** jadi mutation beneran kalau memang masuk scope.

---

*Dokumen ini deskripsi state kode saat spec dibuat (2026-07-26). Verifikasi ulang ke file sumber sebelum dipakai sebagai acuan implementasi.*
