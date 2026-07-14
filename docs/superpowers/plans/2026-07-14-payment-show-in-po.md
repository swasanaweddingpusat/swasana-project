# Tampilkan Pembayaran di PO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah toggle per-pembayaran (cash-in) yang menandai pembayaran mana yang tampil di section Summary Payment PO PDF, plus render baris pembayaran + Sisa Bayar di PO.

**Architecture:** Kolom baru `Ledger.showInPo Boolean @default(false)`. Toggle di-set saat create (create-wizard step 6 + `createCashIn`) atau di-toggle pada riwayat existing (`setLedgerShowInPo`). Saat render PO, route live-fetch Ledger `showInPo:true, voidedAt:null, direction:in` → `poPayments[]` → POPdfDocument. Status termin tetap DERIVED (tidak berubah). Payments selalu live-fetch (tidak ikut snapshot revisi).

**Tech Stack:** Next.js 16.2.3 (App Router, server actions), Prisma 7.7.0 (Neon HTTP — array-form `$transaction` only), React 19, Zod v4, @react-pdf/renderer, TanStack Query v5, shadcn Switch, Solar Icons BoldDuotone.

## Global Constraints

- Migration idempotent (`ADD COLUMN IF NOT EXISTS`) + di-commit bareng perubahan `schema.prisma`. Tabel Prisma `Ledger` → SQL `"ledgers"`.
- Mutation server action WAJIB: `requirePermission` (destructure `{ session, error }`) → `mutationLimiter.check` → Zod validate → `logAudit` → `revalidateTag(..,"max")`. Return `{ success, data? } | { success:false, error }` — never throw ke client.
- Multi-table write pakai `db.$transaction([...])` array form (Neon HTTP). Single-table update ga wajib transaction.
- No hardcode warna — brand token (`primary`, `muted-foreground`, dll). `components/ui/*` JANGAN di-edit; import Switch dari `@/components/ui/switch`.
- No `any` — pakai `unknown` + narrow. Explicit return type di exported function. Import pakai `@/` alias.
- Tailwind v4: `data-attr:class` (bukan `data-[attr]:`), important suffix `class!`.
- ESLint: ga boleh ternary sebagai statement — pakai `if/else` untuk side-effect.
- Default toggle OFF. Toggle ON cukup buat tampil di PO (pending tetap tampil); voided selalu ke-exclude.
- No auto-commit final — tapi tiap task di plan ini punya commit sendiri (user tetap review sebelum push).
- Verifikasi: project TIDAK punya unit test runner. "Test" = `npx tsc --noEmit` (source-only typecheck) + `npx eslint <file>` + smoke manual. Tiap task sebutkan command spesifik.

---

## File Structure

| File | Aksi | Tanggung jawab |
|---|---|---|
| `prisma/schema.prisma` | Modify (model `Ledger`) | Tambah kolom `showInPo Boolean @default(false)` |
| `prisma/migrations/<ts>_add_show_in_po_to_ledger/migration.sql` | Create | Idempotent ADD COLUMN |
| `lib/validations/booking-draft.ts` | Modify (~L196-217) | `payments[].showInPo` optional default false |
| `actions/booking-draft.ts` | Modify (~L994) | Simpan `showInPo` di `db.ledger.create` step-6 |
| `actions/ledger.ts` | Modify | `createCashInSchema.showInPo` + simpan di create + action baru `setLedgerShowInPo` |
| `lib/queries/ledger.ts` | Modify (`BookingCashIn` + `getBookingCashIns`) | Expose `showInPo` |
| `app/(private)/dashboard/booking-weddings/_components/booking-drawer.tsx` | Modify (`PaymentReceiptRow` + UI + payload ~L1579) | Switch "Tampilkan di PO" di step 6 create wizard |
| `app/(private)/dashboard/booking-weddings/_components/_edit-booking/EditPaymentStep.tsx` | Modify | Switch di row baru + toggle di riwayat cash-in |
| `components/pdf/POPdfDocument.tsx` | Modify (interface + Summary Payment ~L785-816) | `poPayments[]` + render baris + Sisa Bayar |
| `app/api/render-po/route.tsx` | Modify (kedua cabang) | Live-fetch showInPo payments → `poPayments` |

Urutan task = dependency order (schema → server write → query read → UI → PO render). Tiap task punya deliverable independen.

---

## Task 1: Kolom `Ledger.showInPo` + migration

**Files:**
- Modify: `prisma/schema.prisma:1189` (model `Ledger`, dekat `evidence`)
- Create: `prisma/migrations/20260714000000_add_show_in_po_to_ledger/migration.sql`

**Interfaces:**
- Produces: kolom DB `ledgers.showInPo BOOLEAN NOT NULL DEFAULT false`; field Prisma `Ledger.showInPo: boolean`.

- [ ] **Step 1: Tambah field di schema**

Di `prisma/schema.prisma`, model `Ledger`, tambah baris tepat setelah `invoiceNumber` (L1190):

```prisma
  invoiceNumber         String?             // no. kwitansi auto-gen server (§7.2)
  notes                 String?
  // Tampilkan cash-in ini di section Summary Payment PO PDF. Default OFF —
  // user sengaja menyalakan per pembayaran. Voided tetap di-exclude saat render.
  showInPo              Boolean             @default(false)
```

- [ ] **Step 2: Tulis migration SQL idempoten**

Buat `prisma/migrations/20260714000000_add_show_in_po_to_ledger/migration.sql`:

```sql
-- Tampilkan pembayaran (cash-in) di section Summary Payment PO PDF.
-- ADDITIVE + idempotent. Default false = zero-regression (PO tampil seperti sebelumnya).
ALTER TABLE "ledgers" ADD COLUMN IF NOT EXISTS "showInPo" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Apply migration ke DB dev + regenerate client**

Run:
```bash
npx prisma migrate deploy && npx prisma generate
```
Expected: migration `20260714000000_add_show_in_po_to_ledger` applied; Prisma Client regenerated tanpa error.

- [ ] **Step 4: Validasi schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260714000000_add_show_in_po_to_ledger/migration.sql
git commit -m "feat(ledger): add showInPo column — flag cash-in buat tampil di PO"
```

---

## Task 2: `createCashIn` + finalize step-6 simpan `showInPo`

**Files:**
- Modify: `actions/ledger.ts:44-57` (`createCashInSchema`) + `actions/ledger.ts:173-191` (`db.ledger.create`)
- Modify: `lib/validations/booking-draft.ts:196-217` (`payments[]` schema)
- Modify: `actions/booking-draft.ts:994-1012` (`db.ledger.create` step-6)

**Interfaces:**
- Consumes: kolom `Ledger.showInPo` dari Task 1.
- Produces: `CreateCashInInput.showInPo?: boolean` (default false); `FinalizeDraftInput.payments[].showInPo?: boolean` (default false). Kedua path nulis `showInPo` ke row Ledger.

- [ ] **Step 1: Tambah `showInPo` ke `createCashInSchema`**

Di `actions/ledger.ts`, dalam `createCashInSchema` (setelah field `allocations`, sebelum `}`), tambah:

```ts
  /** Alokasi ke termin — boleh kosong (unallocated = titipan/overpayment, §6.5 #4). */
  allocations: z.array(allocationInputSchema).default([]),
  /** Tampilkan cash-in ini di Summary Payment PO PDF. Default OFF. */
  showInPo: z.boolean().default(false),
});
```

- [ ] **Step 2: Simpan `showInPo` di `db.ledger.create` (createCashIn)**

Di `actions/ledger.ts`, dalam `ops` array, object `db.ledger.create({ data: {...} })`, tambah field setelah `notes: data.notes ?? null,`:

```ts
          invoiceNumber,
          notes: data.notes ?? null,
          showInPo: data.showInPo,
          createdById: profileId,
```

- [ ] **Step 3: Tambah `showInPo` ke finalize `payments[]` schema**

Di `lib/validations/booking-draft.ts`, dalam `payments` array object (setelah `allocations` block, sebelum object tutup `})`):

```ts
        allocations: z
          .array(
            z.object({
              sortOrder: z.coerce.number().int(),
              amount: z.coerce.number().int().positive(),
            })
          )
          .default([]),
        /** Tampilkan pembayaran ini di Summary Payment PO PDF. Default OFF. */
        showInPo: z.boolean().default(false),
      })
```

- [ ] **Step 4: Simpan `showInPo` di finalize `db.ledger.create` step-6**

Di `actions/booking-draft.ts`, dalam `ops.push(db.ledger.create({ data: {...} }))` step-6, tambah setelah `notes: p.notes?.trim() || null,`:

```ts
              invoiceNumber: kwitansiNumbers[pi] ?? null,
              notes: p.notes?.trim() || null,
              showInPo: p.showInPo ?? false,
              createdById: session!.user.profileId!,
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors di `actions/ledger.ts`, `lib/validations/booking-draft.ts`, `actions/booking-draft.ts`.

- [ ] **Step 6: Commit**

```bash
git add actions/ledger.ts lib/validations/booking-draft.ts actions/booking-draft.ts
git commit -m "feat(ledger): terima & simpan showInPo di createCashIn + finalize step-6"
```

---

## Task 3: Action baru `setLedgerShowInPo` + expose `showInPo` di query

**Files:**
- Modify: `actions/ledger.ts` (tambah action baru di akhir file)
- Modify: `lib/queries/ledger.ts:107-118` (`BookingCashIn`) + `lib/queries/ledger.ts:129-154` (`getBookingCashIns`)

**Interfaces:**
- Consumes: kolom `Ledger.showInPo` (Task 1).
- Produces:
  - `setLedgerShowInPo(input: { ledgerId: string; value: boolean }): Promise<ActionResult>` — toggle showInPo di satu Ledger.
  - `BookingCashIn.showInPo: boolean` — dikonsumsi UI riwayat (Task 5) & finance-detail.

- [ ] **Step 1: Tambah `showInPo` ke `BookingCashIn` interface**

Di `lib/queries/ledger.ts`, interface `BookingCashIn`, tambah field setelah `notes`:

```ts
  invoiceNumber: string | null;
  notes: string | null;
  /** Ditandai tampil di Summary Payment PO PDF. */
  showInPo: boolean;
  /** Nama termin yang di-cover cash-in ini (dari PaymentAllocation). */
  linkedTermNames: string[];
```

- [ ] **Step 2: Select + map `showInPo` di `getBookingCashIns`**

Di `lib/queries/ledger.ts`, `getBookingCashIns`, tambah `showInPo: true,` di `select` (setelah `notes: true,`) dan `showInPo: r.showInPo,` di object return (setelah `notes: r.notes ?? null,`):

```ts
      ackStatus: true,
      invoiceNumber: true,
      notes: true,
      showInPo: true,
      allocations: { select: { term: { select: { name: true } } } },
```
```ts
    invoiceNumber: r.invoiceNumber ?? null,
    notes: r.notes ?? null,
    showInPo: r.showInPo,
    linkedTermNames: r.allocations.map((a) => a.term.name),
```

- [ ] **Step 3: Tulis action `setLedgerShowInPo`**

Di `actions/ledger.ts`, di akhir file, tambah section baru:

```ts
/* ─── Toggle show-in-PO ──────────────────────────────────────────────────────── */

const setShowInPoSchema = z.object({
  ledgerId: z.string().min(1, "ID transaksi tidak valid"),
  value: z.boolean(),
});

/**
 * Set flag `showInPo` satu cash-in — nandain apakah pembayaran ini tampil di
 * Summary Payment PO PDF. Single-table update; tetap logAudit + revalidate.
 * Row void boleh di-toggle (harmless — render PO tetap exclude voidedAt != null).
 */
export async function setLedgerShowInPo(
  input: z.infer<typeof setShowInPoSchema>,
): Promise<ActionResult> {
  const { session, error } = await requirePermission({ module: "finance-ar", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ledger-showinpo:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = setShowInPoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Input tidak valid" };
  }
  const { ledgerId, value } = parsed.data;

  try {
    const ledger = await db.ledger.findUnique({
      where: { id: ledgerId },
      select: { id: true },
    });
    if (!ledger) return { success: false, error: "Transaksi tidak ditemukan." };

    await db.ledger.update({
      where: { id: ledgerId },
      data: { showInPo: value },
    });

    await logAudit({
      userId: session!.user.id,
      action: "ledger.show_in_po_toggled",
      entityType: "ledger",
      entityId: ledgerId,
      changes: { showInPo: value },
      description: `Cash-in ${ledgerId} showInPo = ${value}`,
    });

    revalidateTag("ledger", "max");
    revalidateTag("ar-bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[setLedgerShowInPo]", e);
    return { success: false, error: "Gagal mengubah tampilan PO." };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `logAudit` menerima `changes` (lihat `ledger.created` di file yang sama sebagai referensi shape).

- [ ] **Step 5: Commit**

```bash
git add actions/ledger.ts lib/queries/ledger.ts
git commit -m "feat(ledger): setLedgerShowInPo action + expose showInPo di getBookingCashIns"
```

---

## Task 4: Switch "Tampilkan di PO" di create-wizard step 6

**Files:**
- Modify: `app/(private)/dashboard/booking-weddings/_components/booking-drawer.tsx` — `PaymentReceiptRow` (L158-170), `makeEmptyReceipt` (L179-190), UI row (dalam map paymentReceipts), payload map (L1579-1587)

**Interfaces:**
- Consumes: `FinalizeDraftInput.payments[].showInPo` (Task 2).
- Produces: payload finalize tiap payment sekarang bawa `showInPo: boolean`.

- [ ] **Step 1: Tambah `showInPo` ke `PaymentReceiptRow` + `makeEmptyReceipt`**

Di `booking-drawer.tsx`, interface `PaymentReceiptRow`, tambah setelah `promoId`:

```ts
  /** DiscountProgram id, or "" when no promo applied. */
  promoId: string;
  /** Tampilkan pembayaran ini di Summary Payment PO PDF. Default false. */
  showInPo: boolean;
}
```

Di `makeEmptyReceipt`, tambah `showInPo: false,`:

```ts
    linkedTermUids: [],
    promoId: "",
    showInPo: false,
  };
```

- [ ] **Step 2: Import Switch**

Di `booking-drawer.tsx`, tambah import (dekat import UI lain):

```ts
import { Switch } from "@/components/ui/switch";
```

- [ ] **Step 3: Render Switch di row payment**

Di `booking-drawer.tsx`, cari blok Keterangan (Textarea) di dalam map `paymentReceipts`. Sisipkan blok berikut tepat SEBELUM tombol submit/hapus row (setelah Textarea keterangan). Pakai `updateReceipt(row.uid, { showInPo: v })`:

```tsx
                {/* Tampilkan di PO */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium text-foreground">Tampilkan di PO</p>
                    <p className="text-xs text-muted-foreground">
                      Pembayaran ini muncul di Summary Payment pada dokumen PO.
                    </p>
                  </div>
                  <Switch
                    checked={row.showInPo}
                    onCheckedChange={(v) => updateReceipt(row.uid, { showInPo: v })}
                  />
                </div>
```

> Catatan: nama variabel row di map create-wizard mungkin `receipt`/`r`, bukan `row`. Sesuaikan ke variabel loop yang ada di file (cek parameter `.map((...) => ...)` sekitar section paymentReceipts). Handler mutasi = `updateReceipt`.

- [ ] **Step 4: Sertakan `showInPo` di payload finalize**

Di `booking-drawer.tsx:1579`, object return dalam `payments: paymentReceipts.filter(...).map(...)`, tambah `showInPo`:

```ts
          return {
            occurredAt: r.occurredAt,
            amount: r.amount,
            paymentMethodId: r.paymentMethodId || null,
            discountProgramId: r.promoId || null,
            discountAmount,
            notes: r.notes.trim() || null,
            allocations,
            showInPo: r.showInPo,
          };
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(private)/dashboard/booking-weddings/_components/booking-drawer.tsx"`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(private)/dashboard/booking-weddings/_components/booking-drawer.tsx"
git commit -m "feat(booking): toggle Tampilkan di PO per pembayaran di step 6 create wizard"
```

---

## Task 5: Switch di EditPaymentStep (row baru + riwayat existing)

**Files:**
- Modify: `app/(private)/dashboard/booking-weddings/_components/_edit-booking/EditPaymentStep.tsx` — `PaymentRow` (L36-46), `makeEmptyRow` (L68-79), `handleSubmitRow` createCashIn call (L228-238), UI row + UI riwayat cashIns (L292-325)

**Interfaces:**
- Consumes: `createCashIn({ ..., showInPo })` (Task 2), `setLedgerShowInPo` + `BookingCashIn.showInPo` (Task 3).
- Produces: (UI only) — row baru kirim `showInPo`; riwayat cash-in bisa di-toggle inline.

- [ ] **Step 1: Import Switch + setLedgerShowInPo**

Di `EditPaymentStep.tsx`, ubah import action dan tambah Switch:

```ts
import { createCashIn, setLedgerShowInPo } from "@/actions/ledger";
```
```ts
import { Switch } from "@/components/ui/switch";
```

- [ ] **Step 2: Tambah `showInPo` ke `PaymentRow` + `makeEmptyRow`**

Interface `PaymentRow`, tambah setelah `promoId`:

```ts
  promoId: string;
  /** Tampilkan pembayaran ini di Summary Payment PO PDF. Default false. */
  showInPo: boolean;
}
```

`makeEmptyRow`, tambah `showInPo: false,`:

```ts
    linkedTermIds: [],
    promoId: "",
    showInPo: false,
  };
```

- [ ] **Step 3: Kirim `showInPo` di `createCashIn`**

Di `handleSubmitRow`, object arg `createCashIn({...})`, tambah `showInPo: row.showInPo,` setelah `allocations,`:

```ts
        evidence: evidenceKey,
        notes: row.notes.trim() || null,
        allocations,
        showInPo: row.showInPo,
      });
```

- [ ] **Step 4: Render Switch di row input baru**

Di `EditPaymentStep.tsx`, dalam map `rows.map((row, idx) => {...})`, sisipkan tepat sebelum tombol submit (`<Button ... onClick={() => { void handleSubmitRow(row); }}>`), setelah blok Keterangan:

```tsx
                {/* Tampilkan di PO */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-medium text-foreground">Tampilkan di PO</p>
                    <p className="text-xs text-muted-foreground">
                      Pembayaran ini muncul di Summary Payment pada dokumen PO.
                    </p>
                  </div>
                  <Switch
                    checked={row.showInPo}
                    onCheckedChange={(v) => updateRow(row.uid, { showInPo: v })}
                  />
                </div>
```

- [ ] **Step 5: Tambah toggle di riwayat cash-in existing**

Di `EditPaymentStep.tsx`, tambahkan state + handler di dalam komponen (dekat `submitting` state):

```ts
  const [togglingPo, setTogglingPo] = useState<string | null>(null); // ledger id being toggled

  async function handleTogglePo(ledgerId: string, value: boolean) {
    setTogglingPo(ledgerId);
    try {
      const res = await setLedgerShowInPo({ ledgerId, value });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      await qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
    } catch (e) {
      console.error("[EditPaymentStep] handleTogglePo", e);
      toast.error("Gagal mengubah tampilan PO.");
    } finally {
      setTogglingPo(null);
    }
  }
```

Lalu di blok riwayat (`cashIns.map((ci) => (...))`), tambahkan baris toggle di dalam card, setelah `<AckBadge status={ci.ackStatus} />` block penutup `</div>` baris atas — tepatnya sebelum penutup card `</div>`:

```tsx
                  <AckBadge status={ci.ackStatus} />
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">Tampilkan di PO</span>
                  <Switch
                    checked={ci.showInPo}
                    disabled={togglingPo === ci.id}
                    onCheckedChange={(v) => { void handleTogglePo(ci.id, v); }}
                  />
                </div>
```

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(private)/dashboard/booking-weddings/_components/_edit-booking/EditPaymentStep.tsx"`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add "app/(private)/dashboard/booking-weddings/_components/_edit-booking/EditPaymentStep.tsx"
git commit -m "feat(booking): toggle Tampilkan di PO di editor pembayaran (row baru + riwayat)"
```

---

## Task 6: `POPdfDocument` render baris pembayaran + Sisa Bayar

**Files:**
- Modify: `components/pdf/POPdfDocument.tsx:6-31` (`POPdfBooking` interface) + `components/pdf/POPdfDocument.tsx:810-815` (Summary Payment Sisa Bayar)

**Interfaces:**
- Consumes: (dari Task 7) `POPdfBooking.poPayments`.
- Produces: `POPdfBooking.poPayments?: { label: string; amount: number; occurredAt: string; invoiceNumber: string | null }[]` — dikonsumsi route render (Task 7).

- [ ] **Step 1: Tambah `poPayments` ke interface `POPdfBooking`**

Di `POPdfDocument.tsx`, interface `POPdfBooking`, tambah setelah `discountAmount?: number;`:

```ts
  discountName?: string | null;
  discountAmount?: number;
  /** Cash-in bertanda showInPo (live-fetch, non-void). Kosong = PO kontrak-only. */
  poPayments?: { label: string; amount: number; occurredAt: string; invoiceNumber: string | null }[];
}
```

- [ ] **Step 2: Render baris pembayaran + hitung Sisa Bayar**

Di `POPdfDocument.tsx`, ganti blok "Sisa Bayar" (L810-815, komentar lama "Pembayaran yang sudah masuk dilacak terpisah…") dengan blok berikut. `poPayments` disingkat `pays`; Total = harga setelah diskon (atau harga penuh kalau ga ada diskon):

```tsx
            {/* Baris pembayaran ber-flag showInPo (live-fetch). Kosong → langsung Sisa Bayar = Total. */}
            {(() => {
              const pays = booking.poPayments ?? [];
              const totalPrice = (booking.discountAmount ?? 0) > 0
                ? Math.max(0, (varSnap?.price ?? 0) - (booking.discountAmount ?? 0))
                : (varSnap?.price ?? 0);
              const paid = pays.reduce((sum, p) => sum + p.amount, 0);
              const sisa = Math.max(0, totalPrice - paid);
              return (
                <>
                  {pays.map((p, i) => (
                    <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#000" }}>
                      <Text style={{ width: "70%", fontSize: 6, padding: 2, borderRightWidth: 1, borderColor: "#000" }}>
                        {p.label}
                      </Text>
                      <Text style={{ width: "30%", fontSize: 6, padding: 2 }}>- {fmtRp(p.amount)}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: "row" }}>
                    <Text style={{ width: "70%", fontSize: 6, fontWeight: "bold", padding: 2, borderRightWidth: 1, borderColor: "#000" }}>Sisa Bayar</Text>
                    <Text style={{ width: "30%", fontSize: 6, fontWeight: "bold", padding: 2 }}>{fmtRp(sisa)}</Text>
                  </View>
                </>
              );
            })()}
```

> Ini menggantikan `<View style={{ flexDirection: "row" }}>...Sisa Bayar...</View>` yang lama. Blok Total Payment (L792-796) & Discount (L797-809) TIDAK diubah. Blok baru ini menjadi baris terakhir dalam container `<View break wrap={false} ...>`.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint components/pdf/POPdfDocument.tsx`
Expected: no errors. `fmtRp` sudah ada (L77), `varSnap` sudah ada (L535).

- [ ] **Step 4: Commit**

```bash
git add components/pdf/POPdfDocument.tsx
git commit -m "feat(pdf): render baris pembayaran + Sisa Bayar dari poPayments di PO"
```

---

## Task 7: Route render-po live-fetch payments (kedua cabang)

**Files:**
- Modify: `app/api/render-po/route.tsx` — cabang `revisionId` (L44-80) + cabang live (L105-134); satu fetch showInPo dipakai bersama.

**Interfaces:**
- Consumes: kolom `Ledger.showInPo` (Task 1), `POPdfBooking.poPayments` (Task 6).
- Produces: PO PDF dengan baris pembayaran ter-flag.

- [ ] **Step 1: Live-fetch payments setelah `pdfBooking` ke-set (dua cabang)**

Di `route.tsx`, setelah blok `if (revisionId) {...} else {...}` selesai (yaitu setelah baris `const fileName = ...` — TIDAK, sebelum itu), tambahkan fetch bersama. Tepatnya sisipkan tepat sebelum `const fileName = \`PO_...\`;` (L137):

```ts
    // Payments di PO = event SETELAH snapshot freeze → SELALU live-fetch (tidak ikut
    // revisi). Cuma yang di-flag showInPo & non-void. Pending pun tampil (keputusan
    // spec: toggle ON cukup). Diurut kronologis.
    const poLedgers = await db.ledger.findMany({
      where: { bookingId, direction: "in", showInPo: true, voidedAt: null },
      orderBy: { occurredAt: "asc" },
      select: { id: true, amount: true, occurredAt: true, invoiceNumber: true },
    });
    pdfBooking.poPayments = poLedgers.map((l) => ({
      label: `Pembayaran ${new Date(l.occurredAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Jakarta",
      })}`,
      amount: Number(l.amount),
      occurredAt: l.occurredAt.toISOString(),
      invoiceNumber: l.invoiceNumber ?? null,
    }));

    const fileName = `PO_${customerName}_${venueName}_${eventDate}.pdf`;
```

> `bookingId` sudah tersedia dari `await req.json()` (L30). Berlaku untuk kedua cabang karena `pdfBooking` sudah ke-assign di masing-masing.

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/api/render-po/route.tsx"`
Expected: no errors.

- [ ] **Step 3: Smoke test PO render**

Manual (dev server jalan): buka booking yang punya ≥1 cash-in, nyalakan toggle "Tampilkan di PO" di editor pembayaran, lalu generate/preview PO.
Expected:
- Toggle OFF semua → Summary Payment tampil seperti sebelumnya (Sisa Bayar = Total). Zero-regression.
- Toggle ON 1 pembayaran → muncul 1 baris "Pembayaran <tgl>" dengan nominal, Sisa Bayar = Total − nominal.
- Void pembayaran itu → baris hilang dari PO, Sisa Bayar balik ke Total.

- [ ] **Step 4: Commit**

```bash
git add "app/api/render-po/route.tsx"
git commit -m "feat(render-po): live-fetch pembayaran showInPo → poPayments di PO"
```

---

## Self-Review Checklist (diisi saat eksekusi)

- [ ] **Spec coverage:** kolom showInPo (T1) · createCashIn+finalize simpan (T2) · setLedgerShowInPo+query expose (T3) · Switch create-wizard (T4) · Switch editor+riwayat (T5) · PO render baris+Sisa Bayar (T6) · route live-fetch (T7). Semua section spec §4.1-4.5 tertutup.
- [ ] **Placeholder scan:** tidak ada TODO/TBD; semua step ada kode nyata.
- [ ] **Type consistency:** `showInPo: boolean` konsisten di `Ledger`, `CreateCashInInput`, `FinalizeDraftInput.payments[]`, `PaymentReceiptRow`, `PaymentRow`, `BookingCashIn`. `poPayments` shape identik di interface (T6) & mapper route (T7): `{ label, amount, occurredAt, invoiceNumber }`. Action `setLedgerShowInPo({ ledgerId, value })` konsisten T3↔T5.
- [ ] **Edge case:** `poPayments` kosong → PO kontrak-only (T6 IIFE guard). Voided exclude di where clause (T7). Pending tetap tampil (no ackStatus filter, T7).
