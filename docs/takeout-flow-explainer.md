# Takeout — Penjelasan Visual (end-to-end)

> Bukan spec/desain. Ini penjelasan **cara kerja takeout apa adanya di kode sekarang**
> (branch `feat/finance-fixes`), buat mahamin sebelum mutusin arah fix.
> Sumber: `lib/package-prices.ts`, `actions/snap-package-items.ts`, `actions/booking.ts`,
> `actions/booking-draft.ts`, `components/pdf/POPdfDocument.tsx`, `actions/term-of-payment.ts`.

Takeout = klien nyediain **1 kategori** sendiri (mis. catering) → kategori itu **dipotong
dari harga**. Murni **deduction** — gak pernah nyentuh Ledger (cashbook).

---

## 1. Data model — di mana takeout hidup

```mermaid
erDiagram
    Booking ||--|| SnapPackagePricing : "harga"
    Booking ||--o{ SnapPackageCategoryPrice : "kategori harga"
    Booking ||--o{ SnapPackageVendorItem : "item vendor (PO)"
    Booking ||--o{ TermOfPayment : "jadwal cicilan"

    SnapPackagePricing {
        int fullPrice "KOTOR (anchor, gak ikut berubah)"
        int price "NET = fullPrice - total-takeout"
    }
    SnapPackageCategoryPrice {
        string categoryName
        int basePrice
        boolean isShow
        boolean isTakeout "sumber-kebenaran deduction"
        int takeoutNominal "jumlah potong (0 = pakai basePrice)"
    }
    SnapPackageVendorItem {
        string itemText
        boolean isTakeout "DISPLAY: dicoret di PDF"
    }
    TermOfPayment {
        string name
        int amount "sigma harus == price (net)"
    }
```

**Kunci:** `isTakeout` di **kategori** = angka beneran (potong harga). `isTakeout` di
**item vendor** = cuma tampilan (coret di PO). `fullPrice` = anchor kotor yang gak berubah;
`price` = net hasil potong.

---

## 2. Rumus harga

```mermaid
flowchart LR
    FP["fullPrice / KOTOR<br/>mis. Rp253.800.000"] --> M{{"dikurangi total takeout"}}
    TK["per kategori isShow AND isTakeout:<br/>takeoutNominal, kalau 0 pakai basePrice"] --> M
    M --> NET["price / NET<br/>= yang ditagih = sigma TOP"]
    NET --> TOP["TermOfPayment di-rebalance<br/>pool = termin yang BELUM kebayar"]
```

`calcFinalFromFullPrice()` (`lib/package-prices.ts`): `price = max(0, fullPrice − Σ takeout)`.
`adjustTermsForPriceChange()`: rebalance TOP; termin yang udah ada cash-in ter-ack = dikunci.

---

## 3. Lifecycle yang SEHAT — Create sampai PO/AR

```mermaid
flowchart TD
    A["CREATE: sales toggle takeout di step create"] --> B["FINALIZE (booking-draft.ts:789)<br/>calcFinalFromFullPrice → price NET"]
    B --> C["Snap* dibuat:<br/>category.isTakeout + takeoutNominal<br/>vendorItem.isTakeout<br/>pricing.price = net"]
    C --> D["PO PDF (POPdfDocument.tsx)<br/>item takeout DICORET (line-through + abu)<br/>harga tampil = pricing.price"]
    C --> E["AR / TOP (updateTermOfPayments)<br/>rekonsiliasi pakai pricing.price (stored)"]
```

Di jalur create→finalize, `price` dihitung dari state takeout → **konsisten**.

---

## 4. INTI MASALAH — 2 jalur edit yang divergen

```mermaid
flowchart TD
    U["User ubah takeout di EDIT booking wedding, tab TOP"] --> DR["EditTakeoutContent<br/>(edit-booking-drawer.tsx:188)"]
    DR --> SS["saveSnapTakeout()<br/>(snap-package-items.ts)"]
    SS --> F1["OK: update category.isTakeout + takeoutNominal"]
    SS --> F2["OK: update vendorItem.isTakeout (coret PDF)"]
    SS --> F3["TIDAK: recompute pricing.price"]
    SS --> F4["TIDAK: adjust TOP"]

    EB["editBooking() cabang takeoutChanged<br/>(booking.ts:1520-1572)"] --> R1["OK: recompute price (calcFinalFromFullPrice)"]
    EB --> R2["OK: update pricing.price"]
    EB -.->|"butuh categoryToggles;<br/>wedding drawer kirim [] →<br/>kemungkinan UNREACHABLE"| X["cabang ini jarang / dead dari drawer"]
```

Drawer edit **pakai jalur kiri** (`saveSnapTakeout`) yang **cuma flip flag**, padahal
drawer-nya nampilin "Harga setelah takeout: Rp X" gede. Jalur kanan yang recompute
(`editBooking`) kemungkinan gak kesentuh dari wedding drawer.

---

## 5. Di mana drift-nya kerasa

```mermaid
flowchart LR
    T["Edit takeout via drawer<br/>(saveSnapTakeout)"] --> D1["category.isTakeout = true<br/>tapi pricing.price = STALE (lama)"]
    D1 --> PO["PO: item dicoret (OK)<br/>tapi HARGA masih angka lama"]
    D1 --> AR["TOP reconcile: sigma-termin vs price LAMA<br/>mismatch bisa gak ketauan"]
    D1 --> SIGN["kalau booking udah di-TTD:<br/>takeout berubah TANPA re-approval/re-sign<br/>(temuan #3 spec)"]
```

---

## 6. Ringkasan: bersih vs bocor

| Aspek | Status |
|---|---|
| Konsep deduction (bukan cashflow) | OK — sesuai money-model |
| Data model (kategori-level) | OK — solid |
| Create → finalize (harga & TOP) | OK — konsisten |
| **Edit takeout via drawer** | BOCOR — flag berubah, `price`/TOP TIDAK |
| Post-signature (booking beku) | BOCOR — ubah takeout tanpa re-approval (temuan #3) |
| Coret item di PO | OK — jalan |

**Kesimpulan:** konsep & create-flow sehat. Yang bocor: **edit takeout gak nyambung ke
harga/TOP** (2 jalur, drawer pakai yang gak recompute) + **gak ada gate re-approval** kalau
booking udah ditandatangani klien.

---

## 7. Keputusan yang nunggu (belum dikerjain)

1. **Takeout itu ubah-harga atau display-only?** Sekarang ambigu (drawer nampilin harga
   turun tapi gak persist).
2. Kalau ubah-harga: satu-in 2 jalur biar `price`+TOP selalu sinkron + putusin re-approval
   saat beku.
3. Long-term (spec): unify takeout + discount + bayar-langsung jadi `BookingDeduction`
   (spec bilang "jangan dulu" — refactor berisiko).
