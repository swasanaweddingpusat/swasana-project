# Pengadaan Barang — Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing Add/Edit drawers into ProcurementClient, and add Detail drawer, Approve dialog, and Delete confirmation.

**Architecture:** All modal state lives in `ProcurementClient`. Three new components are created in `_components/`. The existing `ConfirmDialog` shared component is reused for delete (no new wrapper needed). `useDeleteProcurement` and `useApproveProcurement` hooks already exist.

**Tech Stack:** Next.js 16, React 19, TanStack Query v5, react-hook-form + Zod, Shadcn v4 (Dialog, RadioGroup, AlertDialog), Solar BoldDuotone icons, Tailwind v4.

---

## File Map

| Action | File |
|---|---|
| **Create** | `app/(private)/dashboard/pengadaan-barang/_components/ProcurementDetailDrawer.tsx` |
| **Create** | `app/(private)/dashboard/pengadaan-barang/_components/ApproveProcurementDialog.tsx` |
| **Modify** | `app/(private)/dashboard/pengadaan-barang/_components/ProcurementClient.tsx` |

No new shared components — `ConfirmDialog` (`components/shared/confirm-dialog.tsx`) already handles delete.

---

## Task 1: ProcurementDetailDrawer

**Files:**
- Create: `app/(private)/dashboard/pengadaan-barang/_components/ProcurementDetailDrawer.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { Drawer } from "@/components/shared/drawer";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface ProcurementDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProcurementItem | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; dotClass: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING: { label: "Menunggu", dotClass: "bg-amber-500", variant: "outline" },
  APPROVED: { label: "Disetujui", dotClass: "bg-blue-500", variant: "default" },
  REJECTED: { label: "Ditolak", dotClass: "bg-destructive", variant: "destructive" },
  COMPLETED: { label: "Selesai", dotClass: "bg-green-500", variant: "secondary" },
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value ?? "—"}</div>
    </div>
  );
}

export function ProcurementDetailDrawer({
  open,
  onOpenChange,
  item,
}: ProcurementDetailDrawerProps) {
  if (!item) return null;

  const cfg = STATUS_CONFIG[item.status] ?? {
    label: item.status,
    dotClass: "bg-muted-foreground",
    variant: "outline" as const,
  };
  const isImage = item.buktiBelUrl
    ? /\.(jpg|jpeg|png|webp|gif)$/i.test(item.buktiBelUrl)
    : false;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Detail Pengadaan"
      maxWidth="sm:max-w-xl"
    >
      <div className="space-y-5 pb-4">
        {/* Status row */}
        <div className="flex items-center gap-2">
          <Badge
            variant={cfg.variant}
            className="flex items-center gap-1.5 rounded-full text-xs"
          >
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full shrink-0",
                cfg.dotClass
              )}
            />
            {cfg.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(item.createdAt)}
          </span>
        </div>

        {/* Main info */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <Field label="Nama Barang" value={item.namaBarang} />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tanggal Permintaan"
              value={formatDate(item.tanggalPermintaan)}
            />
            <Field label="Venue" value={item.venue?.name} />
            <Field label="Jumlah Barang" value={item.jumlahBarang} />
            <Field label="Sisa Barang" value={item.sisaBarang} />
          </div>
          <Field label="PIC Penerima" value={item.picPenerima} />
          {item.penggunaan && (
            <Field label="Penggunaan" value={item.penggunaan} />
          )}
          {item.division && <Field label="Divisi" value={item.division} />}
        </div>

        {/* Event info */}
        <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
          <Field
            label="Keterangan Acara"
            value={
              item.keteranganAcara === "WEDDING" ? "Wedding" : "Non Wedding"
            }
          />
          {item.weddingNote && (
            <Field label="Wedding Note" value={item.weddingNote} />
          )}
          {item.nonWeddingNote && (
            <Field label="Non Wedding Note" value={item.nonWeddingNote} />
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Total Wedding"
              value={formatCurrency(item.totalWedding)}
            />
            <Field
              label="Total Non Wedding"
              value={formatCurrency(item.totalNonWedding)}
            />
            <Field label="Total" value={formatCurrency(item.total)} />
          </div>
        </div>

        {/* Additional */}
        {(item.linkBarang ?? item.note ?? item.keterangan) && (
          <div className="bg-muted/30 rounded-2xl p-4 space-y-4">
            {item.linkBarang && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Link Barang</p>
                <a
                  href={item.linkBarang}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground underline break-all"
                >
                  {item.linkBarang}
                </a>
              </div>
            )}
            {item.note && <Field label="Catatan" value={item.note} />}
            {item.keterangan && (
              <Field label="Keterangan" value={item.keterangan} />
            )}
          </div>
        )}

        {/* Bukti Beli */}
        {item.buktiBelUrl && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Bukti Beli</p>
            {isImage ? (
              <img
                src={item.buktiBelUrl}
                alt="Bukti beli"
                className="rounded-xl max-h-48 object-cover w-full"
              />
            ) : (
              <a
                href={item.buktiBelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-foreground underline"
              >
                Lihat file bukti beli
              </a>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
          {item.createdBy && (
            <p>
              Dibuat oleh:{" "}
              {item.createdBy.fullName ?? item.createdBy.nickName ?? "—"}
            </p>
          )}
          {item.approvedBy && (
            <p>
              Disetujui oleh: {item.approvedBy.fullName ?? "—"} ·{" "}
              {formatDate(item.approvedAt)}
            </p>
          )}
        </div>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `ProcurementDetailDrawer.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/pengadaan-barang/_components/ProcurementDetailDrawer.tsx"
git commit -m "feat(procurement): add detail drawer component"
```

---

## Task 2: ApproveProcurementDialog

**Files:**
- Create: `app/(private)/dashboard/pengadaan-barang/_components/ApproveProcurementDialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useApproveProcurement } from "@/hooks/useProcurement";
import type { ProcurementItem } from "@/lib/queries/procurement";
import type { ApproveProcurementInput } from "@/lib/validations/procurement";

interface ApproveProcurementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProcurementItem | null;
  onSuccess?: () => void;
}

const ACTIONS: {
  value: ApproveProcurementInput["action"];
  label: string;
  description: string;
}[] = [
  {
    value: "APPROVE",
    label: "Setujui",
    description: "Pengajuan disetujui untuk diproses",
  },
  {
    value: "REJECT",
    label: "Tolak",
    description: "Pengajuan ditolak (wajib isi keterangan)",
  },
  {
    value: "COMPLETE",
    label: "Selesai",
    description: "Pengajuan telah selesai diproses",
  },
];

export function ApproveProcurementDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: ApproveProcurementDialogProps) {
  const [action, setAction] =
    useState<ApproveProcurementInput["action"]>("APPROVE");
  const [keterangan, setKeterangan] = useState("");
  const [keteranganError, setKeteranganError] = useState("");

  const { mutateAsync, isPending } = useApproveProcurement();

  function handleClose() {
    if (isPending) return;
    setAction("APPROVE");
    setKeterangan("");
    setKeteranganError("");
    onOpenChange(false);
  }

  async function handleConfirm() {
    if (action === "REJECT" && !keterangan.trim()) {
      setKeteranganError("Keterangan wajib diisi saat menolak");
      return;
    }
    if (!item) return;
    try {
      await mutateAsync({
        id: item.id,
        data: { action, keterangan: keterangan.trim() || undefined },
      });
      const label = ACTIONS.find((a) => a.value === action)?.label ?? action;
      toast.success(`Pengajuan berhasil di${label.toLowerCase()}.`);
      handleClose();
      onSuccess?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memproses pengajuan"
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tindak Pengajuan</DialogTitle>
          <DialogDescription className="truncate">
            {item?.namaBarang ?? ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup
            value={action}
            onValueChange={(v) =>
              setAction(v as ApproveProcurementInput["action"])
            }
            className="space-y-2"
          >
            {ACTIONS.map(({ value, label, description }) => (
              <div
                key={value}
                className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <RadioGroupItem
                  value={value}
                  id={`action-${value}`}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`action-${value}`}
                  className="cursor-pointer flex-1"
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </label>
              </div>
            ))}
          </RadioGroup>

          {action === "REJECT" && (
            <div className="space-y-1.5">
              <Label htmlFor="approve-keterangan">Keterangan *</Label>
              <Textarea
                id="approve-keterangan"
                rows={3}
                placeholder="Alasan penolakan..."
                value={keterangan}
                onChange={(e) => {
                  setKeterangan(e.target.value);
                  if (keteranganError) setKeteranganError("");
                }}
              />
              {keteranganError && (
                <p className="text-xs text-destructive">{keteranganError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="rounded-full"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={() => {
              void handleConfirm();
            }}
            disabled={isPending}
            className="rounded-full"
          >
            {isPending ? "Memproses..." : "Konfirmasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `ApproveProcurementDialog.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "app/(private)/dashboard/pengadaan-barang/_components/ApproveProcurementDialog.tsx"
git commit -m "feat(procurement): add approve/reject dialog component"
```

---

## Task 3: Wire ProcurementClient

**Files:**
- Modify: `app/(private)/dashboard/pengadaan-barang/_components/ProcurementClient.tsx`

> Note: `AddProcurementDrawer.tsx` and `EditProcurementDrawer.tsx` are already created but untracked — they will be staged in the commit below.

- [ ] **Step 1: Replace ProcurementClient.tsx entirely**

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ProcurementStats } from "./ProcurementStats";
import { ProcurementFilters } from "./ProcurementFilters";
import { ProcurementTable } from "./ProcurementTable";
import { AddProcurementDrawer } from "./AddProcurementDrawer";
import { EditProcurementDrawer } from "./EditProcurementDrawer";
import { ProcurementDetailDrawer } from "./ProcurementDetailDrawer";
import { ApproveProcurementDialog } from "./ApproveProcurementDialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { AddSquare } from "@solar-icons/react";
import {
  useProcurementList,
  useProcurementSummary,
  useDeleteProcurement,
} from "@/hooks/useProcurement";
import type { ProcurementFilterInput } from "@/lib/validations/procurement";
import type { ProcurementItem } from "@/lib/queries/procurement";

interface ProcurementClientProps {
  initialVenues: { id: string; name: string }[];
}

export function ProcurementClient({ initialVenues }: ProcurementClientProps) {
  const [filters, setFilters] = useState<ProcurementFilterInput>({
    page: 1,
    limit: 20,
  });
  const { data, isLoading } = useProcurementList(filters);
  const { data: summary } = useProcurementSummary(filters.venueId);

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProcurementItem | null>(null);
  const [detailItem, setDetailItem] = useState<ProcurementItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [approveItem, setApproveItem] = useState<ProcurementItem | null>(null);

  const { mutateAsync: deleteMutation, isPending: isDeleting } =
    useDeleteProcurement();

  const handleFilterChange = (newFilters: Partial<ProcurementFilterInput>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const findItem = (id: string): ProcurementItem | null =>
    data?.items.find((i) => i.id === id) ?? null;

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation(deleteId);
      toast.success("Pengajuan berhasil dihapus.");
      setDeleteId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus pengajuan"
      );
    }
  }

  const deleteItemName =
    data?.items.find((i) => i.id === deleteId)?.namaBarang ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Pengadaan Barang
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola pengajuan pengadaan dan pembelian barang
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="rounded-full">
          <AddSquare weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
          Tambah Pengajuan
        </Button>
      </div>

      <ProcurementStats summary={summary} isLoading={!summary} />

      <ProcurementFilters
        venues={initialVenues}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      <ProcurementTable
        items={data?.items ?? []}
        total={data?.total ?? 0}
        page={filters.page ?? 1}
        limit={filters.limit ?? 20}
        isLoading={isLoading}
        onPageChange={handlePageChange}
        onView={(id) => setDetailItem(findItem(id))}
        onEdit={(id) => setEditItem(findItem(id))}
        onDelete={(id) => setDeleteId(id)}
        onApprove={(id) => setApproveItem(findItem(id))}
      />

      <AddProcurementDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        venues={initialVenues}
      />

      <EditProcurementDrawer
        open={!!editItem}
        onOpenChange={(o) => {
          if (!o) setEditItem(null);
        }}
        item={editItem}
        venues={initialVenues}
      />

      <ProcurementDetailDrawer
        open={!!detailItem}
        onOpenChange={(o) => {
          if (!o) setDetailItem(null);
        }}
        item={detailItem}
      />

      <ApproveProcurementDialog
        open={!!approveItem}
        onOpenChange={(o) => {
          if (!o) setApproveItem(null);
        }}
        item={approveItem}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null);
        }}
        title="Hapus Pengajuan"
        description={`Hapus pengajuan "${deleteItemName}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel={isDeleting ? "Menghapus..." : "Hapus"}
        cancelLabel="Batal"
        onConfirm={() => {
          void handleDelete();
        }}
        destructive
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors across all modified files.

- [ ] **Step 3: Run lint**

```bash
npm run lint 2>&1 | head -40
```

Expected: no new errors.

- [ ] **Step 4: Commit everything**

```bash
git add "app/(private)/dashboard/pengadaan-barang/_components/ProcurementClient.tsx" \
        "app/(private)/dashboard/pengadaan-barang/_components/AddProcurementDrawer.tsx" \
        "app/(private)/dashboard/pengadaan-barang/_components/EditProcurementDrawer.tsx"
git commit -m "feat(procurement): wire drawers, detail, approve, and delete into client"
```
