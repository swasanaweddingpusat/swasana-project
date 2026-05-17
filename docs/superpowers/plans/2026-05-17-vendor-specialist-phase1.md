# Vendor Specialist Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah menu Vendor Specialist di sidebar (antara Calendar Event dan Groups) dengan halaman yang menampilkan tabel booking dan 3 aksi per baris: Set Vendor, Catering, Decoration — semuanya di-copy dari fitur Booking (bukan di-import).

**Architecture:** Duplikasi komponen dari `bookings/_components/` ke folder baru `vendor-specialist/_components/`. Halaman menggunakan query yang sama dengan Booking (`getBookings`, `useBookings`). Drawer helper `CateringDrawerWrapper`/`DecorationDrawerWrapper` di-include langsung dalam `VendorSpecialistTable` (pattern sama dengan bookings-table.tsx). Booking feature tidak diubah.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, shadcn v4 + Tailwind v4, TanStack Query v5.

---

## File Map

| Action | File |
|---|---|
| **Create** | `prisma/migrations/20260517_add_vendor_specialist_permissions/migration.sql` |
| **Modify** | `app/(private)/dashboard/_components/sidebar/sidebar-config.ts` |
| **Modify** | `lib/route-meta.ts` |
| **Copy** | `vendor-specialist/_components/_catering/helpers.tsx` |
| **Copy** | `vendor-specialist/_components/_catering/sortable-node-row.tsx` |
| **Copy** | `vendor-specialist/_components/_catering/sortable-section-block.tsx` |
| **Copy** | `vendor-specialist/_components/_catering/summary-panel.tsx` |
| **Copy+modify** | `vendor-specialist/_components/SetVendorDrawer.tsx` |
| **Copy+modify** | `vendor-specialist/_components/CateringSelectionDrawer.tsx` |
| **Copy+modify** | `vendor-specialist/_components/DecorationSelectionDrawer.tsx` |
| **Create** | `vendor-specialist/_components/VendorSpecialistTable.tsx` |
| **Create** | `vendor-specialist/_components/VendorSpecialistClient.tsx` |
| **Create** | `vendor-specialist/page.tsx` |
| **Modify** | `AGENTS.md` |

All paths above are relative to `app/(private)/dashboard/`.

---

## Task 1: Permission Migration

**Files:**
- Create: `prisma/migrations/20260517_add_vendor_specialist_permissions/migration.sql`

- [ ] **Step 1: Create migration directory**

```bash
mkdir -p prisma/migrations/20260517_add_vendor_specialist_permissions
```

- [ ] **Step 2: Write migration SQL**

```sql
-- Add vendor-specialist permissions
INSERT INTO "permissions" (id, module, action) VALUES
  (gen_random_uuid()::text, 'vendor-specialist', 'view'),
  (gen_random_uuid()::text, 'vendor-specialist', 'create'),
  (gen_random_uuid()::text, 'vendor-specialist', 'edit'),
  (gen_random_uuid()::text, 'vendor-specialist', 'delete')
ON CONFLICT (module, action) DO NOTHING;
```

- [ ] **Step 3: Validate schema**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260517_add_vendor_specialist_permissions/
git commit -m "feat(vendor-specialist): add permission migration"
```

---

## Task 2: Sidebar + Route Meta

**Files:**
- Modify: `app/(private)/dashboard/_components/sidebar/sidebar-config.ts`
- Modify: `lib/route-meta.ts`

- [ ] **Step 1: Read `sidebar-config.ts`** — confirm exact position of Calendar Event and Groups entries, and confirm the existing hidden vendor-specialist entry location.

- [ ] **Step 2: Update `sidebar-config.ts`**

**2a — Add `Wrench` to the lucide-react import** (already imported, verify it's there):
```ts
import { ..., Wrench, ... } from "lucide-react";
```

**2b — Insert new Vendor Specialist entry between Calendar Event and Groups:**
Find the Groups entry:
```ts
{
  name: "Groups",
  href: "/dashboard/groups",
  icon: Users,
  permission: { module: "groups", action: "view" },
},
```
Insert BEFORE it:
```ts
{
  name: "Vendor Specialist",
  href: "/dashboard/vendor-specialist",
  icon: Wrench,
  permission: { module: "vendor-specialist", action: "view" },
},
```

**2c — Remove the old hidden vendor-specialist entry** (the one with `hidden: true` and 5 submenu items using `vendor_specialist` module). Delete the entire block:
```ts
{
  name: "Vendor Specialist",
  href: "/dashboard/vendor-specialist/pemeliharaan-venue",
  icon: Wrench,
  permission: { module: "vendor_specialist", action: "view" },
  hidden: true,
  submenu: [ ... ],
},
```

- [ ] **Step 3: Update `lib/route-meta.ts`**

Add after the `/dashboard/groups/[groupId]` entry:
```ts
"/dashboard/vendor-specialist": {
  title: "Vendor Specialist",
  subtitle: "Kelola set vendor, catering, dan dekorasi per booking",
},
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "sidebar-config\|route-meta" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(private)/dashboard/_components/sidebar/sidebar-config.ts lib/route-meta.ts
git commit -m "feat(vendor-specialist): add sidebar entry + route meta"
```

---

## Task 3: Copy `_catering/` Helper Files

The 4 files below are copied verbatim — no import changes needed because they import from each other using relative paths that remain the same in the new location.

**Files:**
- Source: `app/(private)/dashboard/bookings/_components/_catering/`
- Destination: `app/(private)/dashboard/vendor-specialist/_components/_catering/`

- [ ] **Step 1: Copy all 4 files**

```bash
cp -r "app/(private)/dashboard/bookings/_components/_catering" \
      "app/(private)/dashboard/vendor-specialist/_components/_catering"
```

Or copy individually on Windows:
```powershell
$src = "app/(private)/dashboard/bookings/_components/_catering"
$dst = "app/(private)/dashboard/vendor-specialist/_components/_catering"
New-Item -ItemType Directory -Force $dst
Copy-Item "$src/*" $dst -Recurse
```

- [ ] **Step 2: Verify 4 files exist**

```bash
ls app/(private)/dashboard/vendor-specialist/_components/_catering/
```

Expected: `helpers.tsx`, `sortable-node-row.tsx`, `sortable-section-block.tsx`, `summary-panel.tsx`

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/vendor-specialist/_components/_catering/"
git commit -m "feat(vendor-specialist): copy _catering helper files"
```

---

## Task 4: Copy + Adapt Drawer Components

Copy the 3 drawer files from bookings and update only their internal imports that reference `_catering/` (which now point to the local copy).

**Files:**
- Copy: `set-vendor-drawer.tsx` → `SetVendorDrawer.tsx`
- Copy: `catering-selection-drawer.tsx` → `CateringSelectionDrawer.tsx`
- Copy: `decoration-selection-drawer.tsx` → `DecorationSelectionDrawer.tsx`

- [ ] **Step 1: Copy SetVendorDrawer**

```bash
cp "app/(private)/dashboard/bookings/_components/set-vendor-drawer.tsx" \
   "app/(private)/dashboard/vendor-specialist/_components/SetVendorDrawer.tsx"
```

No import changes needed — all imports use `@/` absolute paths.

- [ ] **Step 2: Copy CateringSelectionDrawer**

```bash
cp "app/(private)/dashboard/bookings/_components/catering-selection-drawer.tsx" \
   "app/(private)/dashboard/vendor-specialist/_components/CateringSelectionDrawer.tsx"
```

The file imports from `./_catering/...` — these relative paths work correctly in the new location since `_catering/` is in the same directory.

- [ ] **Step 3: Copy DecorationSelectionDrawer**

```bash
cp "app/(private)/dashboard/bookings/_components/decoration-selection-drawer.tsx" \
   "app/(private)/dashboard/vendor-specialist/_components/DecorationSelectionDrawer.tsx"
```

Same as above — `./_catering/...` relative imports work correctly.

- [ ] **Step 4: Verify TypeScript on copied files**

```bash
npx tsc --noEmit 2>&1 | grep "vendor-specialist/_components/Set\|vendor-specialist/_components/Catering\|vendor-specialist/_components/Decoration" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(private)/dashboard/vendor-specialist/_components/SetVendorDrawer.tsx" \
        "app/(private)/dashboard/vendor-specialist/_components/CateringSelectionDrawer.tsx" \
        "app/(private)/dashboard/vendor-specialist/_components/DecorationSelectionDrawer.tsx"
git commit -m "feat(vendor-specialist): copy SetVendorDrawer, CateringSelectionDrawer, DecorationSelectionDrawer"
```

---

## Task 5: Create `VendorSpecialistTable`

Stripped version of `bookings-table.tsx` — same pagination/search/data pattern, only 3 row actions (Set Vendor, Catering, Decoration). Includes `CateringDrawerWrapper` and `DecorationDrawerWrapper` helper components (copied from bookings-table.tsx) at the bottom of the file.

**Files:**
- Create: `app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistTable.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, ArrowLeft, ArrowRight, Wrench, UtensilsCrossed, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/shared/drawer";
import { useBookings } from "@/hooks/use-bookings";
import { SetVendorDrawer } from "./SetVendorDrawer";
import { CateringSelectionDrawer } from "./CateringSelectionDrawer";
import { DecorationSelectionDrawer } from "./DecorationSelectionDrawer";
import type { BookingsResult, BookingListItem, BookingDetail } from "@/lib/queries/bookings";

const STATUS_TEXT: Record<string, string> = {
  Confirmed: "text-green-600 border-border",
  Uploaded:  "text-blue-600 border-border",
  Pending:   "text-orange-500 border-border",
  Rejected:  "text-destructive border-destructive/30",
  Canceled:  "text-muted-foreground border-border",
  Lost:      "text-muted-foreground border-border",
};

const ROWS_PER_PAGE = 10;

export function VendorSpecialistTable({
  initialData,
}: {
  initialData: BookingsResult;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: result = initialData, refetch, isFetching } = useBookings(
    { page: currentPage, pageSize: ROWS_PER_PAGE, search: debouncedSearch },
    initialData,
  );
  const bookings = result.data;
  const totalBookings = result.total;
  const totalPages = Math.ceil(totalBookings / ROWS_PER_PAGE);

  const [vendorTarget, setVendorTarget]       = useState<BookingListItem | null>(null);
  const [cateringTarget, setCateringTarget]   = useState<string | null>(null);
  const [decorationTarget, setDecorationTarget] = useState<string | null>(null);

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-foreground">Vendor Specialist</h2>
              <span className="text-sm rounded-full border border-border bg-secondary px-3 py-1">
                {totalBookings} Bookings
              </span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari customer, PO, venue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border bg-secondary">
                  <TableHead className="px-4 py-2.5 w-12 font-semibold text-muted-foreground text-xs">No</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Customer</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Venue & PO</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Package</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Event Date</TableHead>
                  <TableHead className="px-2 py-2.5 font-semibold text-muted-foreground text-xs">Status</TableHead>
                  <TableHead className="px-2 py-2.5 w-32 font-semibold text-muted-foreground text-xs">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching && bookings.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j} className="px-2 py-3">
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                      Tidak ada booking ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking: BookingListItem, idx: number) => (
                    <TableRow
                      key={booking.id}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm font-medium">{booking.snapCustomer?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{booking.snapCustomer?.mobileNumber ?? ""}</p>
                          {booking.bookingStatus && (
                            <span className={cn(
                              "text-[10px] font-semibold border rounded-full px-2 py-0.5 mt-1 inline-block",
                              STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border",
                            )}>
                              {booking.bookingStatus}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm">{booking.snapVenue?.venueName ?? "—"}</p>
                          {booking.poNumber && (
                            <p className="text-xs text-muted-foreground font-mono">{booking.poNumber}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div>
                          <p className="text-sm">{booking.snapPackage?.packageName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{booking.snapPackageVariant?.variantName ?? ""}</p>
                        </div>
                      </TableCell>

                      <TableCell className="px-2 py-3 text-sm">
                        {booking.eventDate
                          ? format(new Date(booking.eventDate), "dd MMM yyyy")
                          : "—"}
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        {booking.bookingStatus && (
                          <span className={cn(
                            "text-xs font-medium border rounded-full px-2 py-0.5",
                            STATUS_TEXT[booking.bookingStatus] ?? "text-muted-foreground border-border",
                          )}>
                            {booking.bookingStatus}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="px-2 py-3">
                        <div className="flex items-center gap-1">
                          {/* Set Vendor */}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setVendorTarget(booking); }}
                                >
                                  <Wrench className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Set Vendor</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Catering */}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setCateringTarget(booking.id); }}
                                >
                                  <UtensilsCrossed className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Catering PO</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Decoration */}
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); setDecorationTarget(booking.id); }}
                                >
                                  <Palette className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top"><p className="text-xs">Dekorasi PO</p></TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, totalBookings)} dari {totalBookings}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Set Vendor Drawer */}
      <SetVendorDrawer
        open={!!vendorTarget}
        onClose={() => setVendorTarget(null)}
        booking={vendorTarget}
        onSaved={() => refetch()}
      />

      {/* Catering Drawer */}
      {cateringTarget && (
        <CateringDrawerWrapper
          bookingId={cateringTarget}
          onClose={() => setCateringTarget(null)}
          onUpdated={() => refetch()}
        />
      )}

      {/* Decoration Drawer */}
      {decorationTarget && (
        <DecorationDrawerWrapper
          bookingId={decorationTarget}
          onClose={() => setDecorationTarget(null)}
          onUpdated={() => refetch()}
        />
      )}
    </>
  );
}

/* ─── Drawer Wrappers ────────────────────────────────────────────────────── */

function CateringDrawerWrapper({
  bookingId,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Catering" maxWidth="sm:max-w-full">
        <div className="p-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </Drawer>
    );
  }

  return (
    <CateringSelectionDrawer
      isOpen
      onClose={onClose}
      booking={booking}
      onUpdated={onUpdated}
    />
  );
}

function DecorationDrawerWrapper({
  bookingId,
  onClose,
  onUpdated,
}: {
  bookingId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading || !booking) {
    return (
      <Drawer isOpen onClose={onClose} title="Dekorasi">
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </Drawer>
    );
  }

  return (
    <DecorationSelectionDrawer
      isOpen
      onClose={onClose}
      booking={booking}
      onUpdated={onUpdated}
    />
  );
}
```

- [ ] **Step 2: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "VendorSpecialistTable" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistTable.tsx"
git commit -m "feat(vendor-specialist): create VendorSpecialistTable with Set Vendor, Catering, Decoration actions"
```

---

## Task 6: Create `VendorSpecialistClient` + `page.tsx`

**Files:**
- Create: `app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistClient.tsx`
- Create: `app/(private)/dashboard/vendor-specialist/page.tsx`

- [ ] **Step 1: Create `VendorSpecialistClient.tsx`**

Dynamic import wrapper (no SSR) — same pattern as `bookings-table-client.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import type { BookingsResult } from "@/lib/queries/bookings";

const VendorSpecialistTable = dynamic(
  () =>
    import("./VendorSpecialistTable").then((m) => ({
      default: m.VendorSpecialistTable,
    })),
  { ssr: false },
);

export function VendorSpecialistClient({
  initialData,
}: {
  initialData: BookingsResult;
}) {
  return <VendorSpecialistTable initialData={initialData} />;
}
```

- [ ] **Step 2: Create `page.tsx`**

Same pattern as `bookings/page.tsx` — fetches bookings with data scope:

```tsx
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBookings } from "@/lib/queries/bookings";
import { requirePagePermission } from "@/lib/require-page-permission";
import { VendorSpecialistClient } from "./_components/VendorSpecialistClient";
import { cn } from "@/lib/utils";
import type { DataScope } from "@/types/user";

export const metadata: Metadata = {
  title: "Vendor Specialist",
  description: "Kelola set vendor, catering, dan dekorasi",
};

export default async function VendorSpecialistPage() {
  await requirePagePermission("vendor-specialist");

  const session = await auth();
  const profileId = session?.user?.profileId ?? undefined;
  let dataScope: DataScope = "own";

  if (profileId) {
    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { dataScope: true },
    });
    if (profile) dataScope = profile.dataScope as DataScope;
  }

  const bookings = await getBookings(profileId, dataScope);

  return (
    <div className={cn("flex", "flex-col", "mb-6", "px-2")}>
      <VendorSpecialistClient initialData={bookings} />
    </div>
  );
}
```

- [ ] **Step 3: Check TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "vendor-specialist/page\|VendorSpecialistClient" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(private)/dashboard/vendor-specialist/_components/VendorSpecialistClient.tsx" \
        "app/(private)/dashboard/vendor-specialist/page.tsx"
git commit -m "feat(vendor-specialist): create page + client wrapper"
```

---

## Task 7: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Add `vendor-specialist` to the permission module table in Section 5**

Find the permissions table and add:
```markdown
| `vendor-specialist` | `view`, `create`, `edit`, `delete` |
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add vendor-specialist permissions to AGENTS.md"
```

---

## Task 8: Build Verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "\.next" | head -30
```

Fix any errors in vendor-specialist files. Ignore pre-existing errors in other files.

- [ ] **Step 2: Run build**

```bash
npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` — route `/dashboard/vendor-specialist` appears in the route table.

- [ ] **Step 3: Apply permission migration to DB**

```bash
npx prisma migrate deploy
```

Expected: migration `20260517_add_vendor_specialist_permissions` applied.

- [ ] **Step 4: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(vendor-specialist): post-build fixes"
```

---

## Self-Review

| Spec Requirement | Task |
|---|---|
| Sidebar entry antara Calendar Event dan Groups | Task 2 |
| Route `/dashboard/vendor-specialist` | Task 6 |
| route-meta entry | Task 2 |
| Tabel booking (copy pattern dari bookings-table) | Task 5 |
| Row action: Set Vendor | Task 5 |
| Row action: Catering | Task 5 |
| Row action: Decoration | Task 5 |
| CateringDrawerWrapper + DecorationDrawerWrapper | Task 5 |
| Copy _catering/ helpers | Task 3 |
| Copy SetVendorDrawer | Task 4 |
| Copy CateringSelectionDrawer | Task 4 |
| Copy DecorationSelectionDrawer | Task 4 |
| Permission migration SQL | Task 1 |
| AGENTS.md update | Task 7 |
| Booking feature tidak diubah | ✅ tidak ada task yang menyentuh bookings/ |
