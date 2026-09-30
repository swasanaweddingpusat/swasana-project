# Quotation — Gap Audit

## 1. Field belum E2E

- `validUntil` — ada di schema/zod/action, **nol input di drawer**; cuma dipakai badge "Expired" (`quotations-table.tsx:397`). Praktis selalu null.
- `notes` — ada di zod/action/preview, tapi **tidak ada di payload** `onSubmit` (`quotation-drawer.tsx:2279`). Kolom Notes dokumen selalu kosong.
- `paymentNote` — sama: nol input, nol di payload. Preview selalu jatuh ke `DEFAULT_PAYMENT_NOTE`.
- `QuotationTerm.paymentStatus` / `paymentEvidence` — `prisma/schema.prisma:2607-2608`, **nol referensi** di actions/app/lib/components. Kolom mati.
- `QuotationPrice.description` — drawer selalu kirim `description: null`; deskripsi harga dari package hilang saat simpan.
- `QuotationComplimentary.qty` / `QuotationBonus.qty` — tidak ada input UI, hardcode `qty: 1` (`quotation-drawer.tsx:3013`). Qty dari package tersalin tapi tak bisa diedit.
- **Bug nyata** — di `updateQuotation` (`actions/quotation.ts:396-431`), field `instansi`, `venueName`, `eventTypeName`, `place`, `details`, `time`, `bookingFee`, `discountName`, `signingLocation`, `signatureSales` ditulis **tanpa guard `!== undefined`** → update partial (mis. status-only) akan **meng-null-kan** semuanya.
- `status` — `useUpdateQuotationStatus` (`hooks/use-quotations.ts:97`) tidak dipakai di UI mana pun; tabel hanya render "Siap"/"Converted". Transisi sent/accepted/rejected tak pernah terjadi.
- `SnapQuotationPackage` — diisi di create & duplicate, di update hanya kalau `packageId !== undefined` (`actions/quotation.ts:571`), dan **tidak pernah dibaca balik** (`lib/queries/quotations.ts` tak select `packageSnapshot`) → write-only.

## 2. Package: meeting-package vs custom

- **custom** = jalur yang benar-benar E2E; semua input manual tersimpan dan terbaca balik.
- **meeting-package** tersalin cukup lengkap lewat `handleApplyPackage` (`quotation-drawer.tsx:1702`): miceItems→items, micePrices→prices, taxDeposits, complimentaries, bonuses, pax, paymentMethodId, termAndCondition, cancellationPolicy, closingNote.
- Yang TIDAK tersalin: `QuotationPrice.description` (dibuang jadi null) dan qty/price `miceItems` (di-reset string kosong) → item paket masuk sebagai baris tanpa harga.
- Saat edit dibuka ulang, `packageSource` dipulihkan tapi snapshot tidak dipakai untuk apa pun — tidak ada jalur "restore dari snapshot". Snapshot = arsip pasif.

## 3. Hilang saat convert ke Booking

Dari `convertQuotationToMiceBooking` (`actions/quotation.ts:~940-1050`):

- **`prices` TIDAK terbawa** — tidak ada write snap harga sama sekali, padahal ini komponen utama subtotal. Sisa hanya angka agregat di `snapPackagePricing`.
- **`taxDeposits` TIDAK terbawa** — nol referensi tax/deposit di seluruh fungsi convert.
- `additionals` ter-flatten: semua `items` (ITEM + ADDITIONAL) jadi `snapPackageInternalItem` (nama+deskripsi saja); `qty`/`price`/`total`/`manualTotal` hilang.
- `terms` → `termOfPayment` hanya bawa name/amount/dueDate/sortOrder.
- Ikut hilang: `place`, `eventEndDate`, `bookingFee`, `paymentNote`, `cancellationPolicy`, `closingNote`, `validUntil`, dan `bankName`/`bankAccountNumber`/`bankRecipient` yang sudah dibekukan.
- **Risiko**: kalau paket master terhapus, blok `if (livePackage && quotation.packageName)` tidak jalan → `snapPackagePricing` tak dibuat → booking lahir **tanpa angka harga sama sekali**.

## 4. Payment di quotation: perlu / tidak

- **Tidak perlu.** Pembayaran mulai setelah jadi Booking, bukan di Quotation.
- Arsitektur yang berlaku sudah menyatakan itu: `prisma/schema.prisma:1710-1714` mencatat kolom pembayaran di `TermOfPayment` sengaja **di-drop**, "berapa sudah terbayar" DERIVED dari Ledger via `PaymentAllocation`. `docs/finance-ar-invoice-issue-spec.md` menempatkan invoice/kwitansi di level Booking + TermOfPayment.
- Jadi `QuotationTerm.paymentStatus`/`paymentEvidence` bukan sekadar "belum dipakai" — itu **peninggalan model lama** yang sudah ditinggalkan di sisi Booking. Menghidupkannya = bikin sumber kebenaran pembayaran kedua yang bertentangan dengan Ledger.
- Rekomendasi: drop kedua kolom lewat migration; perlakukan `QuotationTerm` murni sebagai *jadwal termin yang diusulkan*. Booking fee yang masuk sebelum konversi dicatat sebagai cash-in di Ledger, dialokasikan setelah booking lahir.

## Catatan di luar scope (dampak besar)

- `getEligibleMiceQuotations` (`lib/queries/miceBookings.ts:44-47`) INNER JOIN ke `approval_records` `module='quotations' AND status='approved'`, dan `isQuotationApproved` menggate `convertApprovedQuotationToMiceBooking`. Tapi **tidak ada kode yang pernah membuat ApprovalRecord bermodul `quotations`** — flow terdefinisi di `lib/approval-flows.ts:50` tapi tak pernah dipanggil. Jalur convert lewat `booking-mice.ts` selalu nol hasil / selalu ditolak; yang jalan hanya `convertQuotationToMiceBooking` yang memang tak cek approval. Efektifnya ada dua jalur convert: satu mati, satu tanpa approval.
