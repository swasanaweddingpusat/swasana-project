# Audit Sistem Booking — Juli 2026

> Read-only audit. Belum ada perubahan kode. Temuan diverifikasi manual di mana ditandai CONFIRMED.
> Cakupan: server actions, snapshot/freeze/revision, concurrency/transaksi, tipe data, client-side drawer.
> Audit performa DB (queries/index) menyusul.

Status verifikasi: temuan CRITICAL sudah di-cross-check ke kode. 1 temuan dibuang (false-positive):
Audit-D "double-click guard bocor" — aman karena draft idempotent + sudah di-await sebelum setCurrentStep.

---

## 0. TIPE DATA (jawaban pertanyaan kapasitas)

| Item | Kolom | Tipe | Kapasitas | Verdict |
|---|---|---|---|---|
| Nomor PO per tahun | `counters.value` (`po-<year>`) | Int | 2,14 miliar | ✅ Aman (5000/th kosmetik, padStart(3) cuma mengembang) |
| Nomor invoice/TOP per tahun | `counters.value` (`invoice-<year>`) | Int | 2,14 miliar | ✅ Aman (200rb/th, format tanpa padding) |
| Reset per tahun | key `-<year>` | — | — | ✅ Ya, baris counter baru tiap tahun |
| **Nominal uang per baris** | amount/price/fullPrice/discountAmount/totalPrice/nominal/basePrice/takeoutNominal/itemPrice | **Int** | **Rp 2.147.483.647 / baris** | ⚠️ **RISIKO overflow** |

**[T-01] HIGH — Semua kolom uang bertipe Int (32-bit)**
`prisma/schema.prisma` (banyak: TermOfPayment.amount:1037, PartialPayment.amount:1063, SnapPackagePricing.price:890/fullPrice:891, Booking.discountAmount:709, dst).
- Skenario gagal: 1 term/harga paket/total > Rp 2,14 miliar → Postgres tolak (`integer out of range`) → **simpan GAGAL**. Realistis untuk wedding/MICE premium.
- Fix: migrasi kolom uang `Int → BigInt`. Perlu penyesuaian TS (BigInt ≠ number) + serialisasi JSON. Non-urgent jika transaksi < 2 M/term, wajib jika ada rencana miliaran.
- Confidence: CONFIRMED (tipe Int = fakta).

---

## 1. AKAR TUNGGAL — Revisi dibuat DI LUAR transaksi utama

Beberapa temuan CRITICAL/HIGH menunjuk satu akar. Fix akar ini menyelesaikan F-14, B-2, B-8 sekaligus.

**[R-01] CRITICAL — createBookingRevision di transaksi terpisah (2-phase commit gap)**
`actions/booking-draft.ts:1042` (finalizeDraftBooking), `actions/booking.ts` editBooking (~1710).
- CONFIRMED. Main `db.$transaction(ops)` commit dulu; `revisionFlow()` jalan terpisah via Promise.all.
- Efek F-14: revisionFlow throw → outer catch → return {success:false}, PADAHAL booking sudah tersimpan. User "Gagal" → retry → "sudah difinalisasi". Booking nyangkut tanpa currentRevisionId.
- Efek B-2: 2 edit concurrent → revisionNumber sama → unique violation (`@@unique([bookingId, revisionNumber])`) → revisi gagal, data booking terlanjur berubah.
- Efek B-8: approval step tak ter-link revisionId → sign no-op, booking tak pernah Confirmed.
- Fix: masukkan createBookingRevision + link-step ke transaksi utama; revisionId via crypto.randomUUID() di luar; revisionNumber via counter atomik (pola getNextSequence), bukan MAX+1 baca-lalu-tulis.

---

## 2. CRITICAL lain

**[C-01] CRITICAL — Customer orphan + lead "phantom converted"**
`actions/booking.ts:186`, `actions/booking-draft.ts:211`.
- Customer dibuat & lead di-stamp "converted" DI LUAR transaksi booking. Jika findUniqueOrThrow(package) atau transaksi booking gagal → customer nyangkut tanpa booking, lead ter-mark converted tanpa booking.
- Fix: validasi venue/package exist dulu → lock lead → create customer + booking dalam SATU transaksi. Confidence: CONFIRMED.

**[C-02] CRITICAL — draft.customer null crash saat finalize**
`actions/booking-draft.ts:641` (akses customer.id tanpa guard).
- Customer di-delete admin setelah draft dibuat → customer null → crash. Counter PO/invoice sudah ter-increment (bocor).
- Fix: guard `if (!draft.customer) return {success:false,...}` sebelum pakai. Confidence: CONFIRMED.

**[C-03] CRITICAL — Evidence bayar hilang silent untuk term baru**
`app/(private)/dashboard/booking-weddings/_components/edit-top-drawer.tsx:258`.
- User tambah term baru + lampirkan bukti → loop upload skip id `new-*` → server create term → evidence tak pernah ter-upload, hilang tanpa error.
- Fix: setelah updateTermOfPayments sukses, fetch termId baru dari hasil, lalu upload evidence pending untuk term yang baru dibuat. Confidence: CONFIRMED.

**[C-04] HIGH→CRITICAL (edge) — Term ber-evidence bisa ke-DELETE**
`actions/booking-draft.ts:471`.
- Matching term pakai sortOrder, bukan ID. Jika sortOrder DB tak kontinu ([0,5,10]) tapi payload [0,1,2] → term sortOrder 5/10 (punya evidence) ke-hapus.
- Fix: matching by term ID, atau wajibkan sortOrder eksplisit di schema step-3. Confidence: CONFIRMED.

---

## 3. HIGH

**[H-01] approveBooking tak menjalankan approval flow** — `actions/booking.ts:1857`. Hanya update managerId; tak sentuh ApprovalRecord/Step/bookingStatus. Kemungkinan legacy. **Perlu konfirmasi: masih dipakai UI?** logAudit pakai profileId, bukan user.id.

**[H-02] Vendor swap hilang saat concurrent material-change** — `snap-package-items.ts:99` vs `booking.ts:1494`. saveSnapVendorItems (frozen) commit, lalu editBooking material-change deleteMany+recreate snap vendor dari master → swap hilang tanpa error. Confidence: SUSPECTED (timing).

**[H-03] Sign & generateToken race ("signed zombie" terbalik)** — `app/api/client-agreement/sign/route.ts`. Double-click sign / regenerate barengan → agreement Signed tapi booking di-reset Pending. Fix: atomic check-and-set `updateMany({where:{token,status:{not:"Signed"}}})` cek count. Confidence: CONFIRMED.

**[H-04] revisionNumber TOCTOU** — `lib/booking-revision.ts:33`. (bagian dari R-01) MAX+1 baca-lalu-tulis → unique violation saat concurrent. Fix: counter atomik.

---

## 4. MEDIUM

- **M-01** `sign/route.ts` accessCode `Math.random()` (bukan CSPRNG) → mending crypto.randomBytes/randomInt. CONFIRMED.
- **M-02** `transferBookingManager` (`booking.ts:937`) cek role via string `"manager"` → langgar AGENTS.md, pakai flag. CONFIRMED.
- **M-03** `addTermOfPayment` (`term-of-payment.ts:86`) sortOrder race → duplikat urutan. CONFIRMED.
- **M-04** `createBooking` pakai getNextSequence loop (non-batch) → invoice bisa tak urut. Draft flow sudah batch. CONFIRMED (minor).
- **M-05** clientAgreement reset di transaksi terpisah dari step creation (`booking.ts:1783`) → bisa stale token. CONFIRMED.
- **M-06** snapshotData bisa partial-null tanpa error (`booking-revision.ts:41`) → render-po null crash. SUSPECTED (hardening).
- **M-07** Client-side deps: specialBonusAmount missing di effect deps (`booking-drawer.tsx:866`), salesId init stale (`edit-booking-drawer.tsx:200`), JSON.stringify di useEffect deps (`EditPackageItemsDrawer.tsx:46`), vendor category clear tak update state (`PackageItemsEditor.tsx:303`). Mostly SUSPECTED.

---

## 5. LOW / catatan

- eventDate compare di logAudit pakai toISOString vs UTC getters (inkonsistensi minor).
- hasPendingWriteError stale closure step 5→6 (`booking-drawer.tsx`) — butuh refactor backgroundSave return boolean.
- Resume draft mendarat step 3 (Item Paket) — BUKAN bug, desain Phase 1 (review item dulu).

---

## Rekomendasi urutan fix

1. **R-01** (akar revisi-di-luar-transaksi) — nyelesein F-14 + B-2 + B-8.
2. **C-01** customer orphan / lead phantom.
3. **C-03 + C-04** evidence hilang / term ke-delete (langsung kena data user).
4. **C-02** guard draft.customer null.
5. **T-01** BigInt untuk kolom uang (kalau ada rencana nominal > 2 M/term).
6. Sisanya (H/M) sesuai prioritas bisnis.

## Perlu konfirmasi dari user
- approveBooking masih dipakai di UI? (H-01)
- Nominal transaksi realistis > Rp 2,14 M/term? (T-01 urgensi)
