# Pengadaan Barang — Wiring Design

**Date:** 2026-06-10  
**Branch:** seeddatacalandar  
**Scope:** Wire existing Add/Edit drawers, add Detail drawer, Approve dialog, Delete dialog into ProcurementClient

---

## Context

The procurement feature has API routes, hooks, validations, and UI components already built. Two components exist as untracked files (`AddProcurementDrawer`, `EditProcurementDrawer`) but are not connected. `ProcurementClient` has a placeholder button and no action handlers wired to the table.

---

## What's Being Built

### New Components (all in `app/(private)/dashboard/pengadaan-barang/_components/`)

**`ProcurementDetailDrawer.tsx`**  
Read-only drawer showing all fields of a `ProcurementItem`: tanggal permintaan, venue, nama barang, jumlah, sisa, PIC penerima, penggunaan, divisi, keterangan acara, wedding/non-wedding notes, totals, link barang, note, status badge, and bukti beli (link or image preview). Uses the existing `Drawer` shared component.

**`ApproveProcurementDialog.tsx`**  
Dialog for the approve flow. Supports three actions: APPROVE, REJECT, COMPLETE (maps to `approveProcurementSchema`). When REJECT is selected, a `keterangan` textarea becomes required. Uses `useApproveProcurement` hook. On success, invalidates the procurement query cache. Layout: title, item name subtitle, **radio group** (APPROVE / REJECT / COMPLETE), conditional keterangan textarea (shown only when REJECT selected), Batal/Konfirmasi buttons.

**`DeleteProcurementDialog.tsx`**  
AlertDialog confirming deletion. Message: "Hapus pengajuan [nama barang]? Tindakan ini tidak dapat dibatalkan." Uses `useDeleteProcurement` hook. Buttons: Batal (outline) / Hapus (destructive).

---

## Changes to `ProcurementClient`

### State added
```ts
const [addOpen, setAddOpen] = useState(false);
const [editItem, setEditItem] = useState<ProcurementItem | null>(null);
const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);
const [deleteId, setDeleteId] = useState<string | null>(null);
const [approveItem, setApproveItem] = useState<ProcurementItem | null>(null);
```

### Handler logic
- `onView(id)` — finds item from `data.items`, sets `detailItem`
- `onEdit(id)` — finds item from `data.items`, sets `editItem`
- `onDelete(id)` — sets `deleteId`
- `onApprove(id)` — finds item from `data.items`, sets `approveItem`

### Placeholder button replaced
The static `<button data-add-procurement>` is replaced with an actual `<Button>` that calls `setAddOpen(true)`.

### Component mounting
All five components rendered below the table, each controlled by their respective state slice:
- `<AddProcurementDrawer open={addOpen} onOpenChange={setAddOpen} venues={initialVenues} />`
- `<EditProcurementDrawer open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)} item={editItem} venues={initialVenues} />`
- `<ProcurementDetailDrawer open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)} item={detailItem} />`
- `<ApproveProcurementDialog open={!!approveItem} onOpenChange={(o) => !o && setApproveItem(null)} item={approveItem} />`
- `<DeleteProcurementDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} id={deleteId} name={data?.items.find(i => i.id === deleteId)?.namaBarang ?? ""} />`

---

## Constraints

- All new components use Solar BoldDuotone icons, no lucide-react
- No hardcoded colors — only Tailwind tokens
- `rounded-2xl` for containers, `rounded-xl` for inputs, `rounded-full` for buttons
- No `console.log` in runtime code
- No `any` types — use `ProcurementItem` from `@/lib/queries/procurement`
- `useDeleteProcurement` and `useApproveProcurement` already exist in `hooks/useProcurement.ts`
