"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Pen, TrashBinTrash, AddCircle, UsersGroupRounded, ArrowLeft, ArrowRight, Magnifer, Copy, Refresh } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import { PermissionGate } from "@/components/shared/permission-gate";
import { useCustomers, useDeleteCustomer, useDeleteBulkCustomers } from "@/hooks/use-customers";
import { useIsMobile } from "@/hooks/use-mobile";
import { parseMobileNumbers } from "@/lib/validations/customer";
import { CustomerDrawer } from "./customer-drawer";
import type { CustomerItem, CustomersResult } from "@/lib/queries/customers";

function formatMobileNumbers(raw: unknown): string {
  const entries = parseMobileNumbers(raw);
  return entries.map((e) => e.name ? `${e.name}: ${e.number}` : e.number).join(", ");
}

function mobileNumbersSearchable(raw: unknown): string {
  const entries = parseMobileNumbers(raw);
  return entries.map((e) => `${e.name} ${e.number}`).join(" ").toLowerCase();
}

const ROWS_PER_PAGE = 10;

const MEMBER_STATUS_COLORS: Record<string, string> = {
  "VIP": "bg-primary text-primary-foreground",
  "Member": "bg-secondary text-secondary-foreground",
  "Non-Member": "bg-muted text-muted-foreground",
};

// ─── Mobile Card ──────────────────────────────────────────────────────────────

function MobileCustomerCard({
  customer,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  customer: CustomerItem;
  selected: boolean;
  onSelect: () => void;
  onEdit: (c: CustomerItem) => void;
  onDelete: (c: CustomerItem) => void;
}) {
  const phones = parseMobileNumbers(customer.mobileNumber);

  return (
    <Card className={cn("rounded-2xl border transition-colors", selected && "bg-muted/50")}>
      <CardContent className="p-4 space-y-3">
        {/* Row 1: checkbox + name + status */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            aria-label={`Pilih ${customer.name}`}
            className="mt-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{customer.name}</p>
            {phones.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {phones[0]?.name ? `${phones[0].name}: ` : ""}{phones[0]?.number}
                {phones.length > 1 && <span className="ml-1 text-muted-foreground/70">+{phones.length - 1}</span>}
              </p>
            )}
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs shrink-0", MEMBER_STATUS_COLORS[customer.memberStatus] ?? "")}
          >
            {customer.memberStatus}
          </Badge>
        </div>

        {/* Row 2: type + bitrixId */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {customer.type && <span className="bg-muted px-2 py-0.5 rounded-full">{customer.type}</span>}
          {customer.bitrixId && (
            <button
              type="button"
              className="flex items-center gap-1 group"
              onClick={() => { navigator.clipboard.writeText(customer.bitrixId!); toast.success("Bitrix ID copied!"); }}
            >
              <Badge variant="secondary" className="font-mono text-xs">{customer.bitrixId}</Badge>
              <Copy weight="BoldDuotone" className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Row 3: notes + updated */}
        {(customer.notes || customer.updatedBy) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {customer.notes && <p className="truncate">{customer.notes}</p>}
            <p>
              {customer.updatedBy && <span>{customer.updatedBy} · </span>}
              {format(new Date(customer.updatedAt), "dd MMM yyyy")}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t">
          <PermissionGate module="customers" action="edit">
            <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={() => onEdit(customer)}>
              <Pen weight="BoldDuotone" className="h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <PermissionGate module="customers" action="delete">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(customer)}
            >
              <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
              Hapus
            </Button>
          </PermissionGate>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export function CustomersTable({ initialData }: { initialData: CustomersResult }) {
  const { data: customersResult } = useCustomers(initialData);
  const customers = customersResult?.data ?? initialData.data;
  const deleteMut = useDeleteCustomer();
  const bulkDeleteMut = useDeleteBulkCustomers();
  const isMobile = useIsMobile();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  function handleDrawerClose(open: boolean) {
    setDrawerOpen(open);
    if (!open) qc.invalidateQueries({ queryKey: ["customers"] });
  }
  const [deleteTarget, setDeleteTarget] = useState<CustomerItem | null>(null);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      mobileNumbersSearchable(c.mobileNumber).includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.type ?? "").toLowerCase().includes(q) ||
      (c.club ?? "").toLowerCase().includes(q) ||
      (c.memberStatus ?? "").toLowerCase().includes(q) ||
      (c.notes ?? "").toLowerCase().includes(q) ||
      (c.updatedBy ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  function handleEdit(customer: CustomerItem) {
    setEditCustomer(customer);
    setDrawerOpen(true);
  }

  function handleAdd() {
    setEditCustomer(null);
    setDrawerOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const result = await deleteMut.mutateAsync(deleteTarget.id);
      if (result.success) {
        toast.success("Customer dihapus.");
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
        qc.invalidateQueries({ queryKey: ["customers"] });
      } else {
        toast.error(result.error ?? "Gagal menghapus customer.");
      }
    } catch {
      toast.error("Gagal menghapus customer.");
    } finally {
      setDeleteTarget(null);
    }
  }

  const allSelected = paginated.length > 0 && paginated.every((c) => selectedIds.has(c.id));

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        paginated.forEach((c) => next.delete(c.id));
      } else {
        paginated.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }, [allSelected, paginated]);

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    try {
      const res = await bulkDeleteMut.mutateAsync(ids);
      if (res.success) {
        toast.success(`${ids.length} customer dihapus.`);
        setSelectedIds(new Set());
        qc.invalidateQueries({ queryKey: ["customers"] });
      } else {
        toast.error(res.error ?? "Gagal menghapus.");
      }
    } catch {
      toast.error("Gagal menghapus.");
    } finally {
      setBulkDeleteOpen(false);
    }
  }

  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'gap-3', 'px-4', 'sm:px-6', 'py-4', 'border-b', 'sm:flex-row', 'sm:items-center', 'sm:justify-between')}>
            <div className={cn('flex', 'items-center', 'gap-3')}>
              <h2 className={cn('text-base', 'font-bold', 'text-foreground')}>List Customers</h2>
              <span className={cn('text-xs', 'font-medium', 'bg-muted', 'text-muted-foreground', 'px-3', 'py-1', 'border', 'rounded-full')}>
                {filtered.length} {search ? `dari ${customers.length}` : "member"}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={isRefreshing}
                className={cn('h-8', 'px-2')}
                title="Refresh data"
                onClick={async () => {
                  setIsRefreshing(true);
                  await qc.invalidateQueries({ queryKey: ["customers"] });
                  setIsRefreshing(false);
                }}
              >
                <Refresh weight="BoldDuotone" className={cn("h-3.5 w-3.5 text-muted-foreground", isRefreshing && "animate-spin")} />
              </Button>
            </div>
            <div className={cn('flex', 'items-center', 'gap-2', 'flex-wrap')}>
              {selectedIds.size > 0 && (
                <PermissionGate module="customers" action="delete">
                  <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                    <TrashBinTrash weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-1.5')} /> Hapus ({selectedIds.size})
                  </Button>
                </PermissionGate>
              )}
              <div className="relative flex-1 sm:flex-none">
                <Magnifer weight="BoldDuotone" className={cn('absolute', 'left-3', 'top-1/2', '-translate-y-1/2', 'h-4', 'w-4', 'text-muted-foreground')} />
                <Input
                  placeholder="Cari customer..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className={cn('pl-9', 'w-full', 'sm:w-55')}
                />
              </div>
              <PermissionGate module="customers" action="create">
                <Button onClick={handleAdd} className={cn('cursor-pointer', 'w-full', 'sm:w-auto')}>
                  <AddCircle weight="BoldDuotone" className={cn('h-4', 'w-4', 'mr-2')} />
                  <span className="sm:inline">Tambah Customer</span>
                </Button>
              </PermissionGate>
            </div>
          </div>

          {/* Content — mobile cards / desktop table */}
          {filtered.length === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'py-16', 'text-muted-foreground')}>
              <UsersGroupRounded weight="BoldDuotone" className={cn('h-10', 'w-10', 'mb-3', 'opacity-40')} />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada customer."}</p>
            </div>
          ) : isMobile ? (
            /* Mobile: card list */
            <div className="p-4 space-y-3">
              {paginated.map((customer) => (
                <MobileCustomerCard
                  key={customer.id}
                  customer={customer}
                  selected={selectedIds.has(customer.id)}
                  onSelect={() => toggleOne(customer.id)}
                  onEdit={handleEdit}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          ) : (
            /* Desktop: table */
            <div className="overflow-x-auto">
              <Table className={cn('min-w-225', 'text-sm')}>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className={cn('px-3', 'w-12')}>
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </TableHead>
                    <TableHead className="px-3">Nama</TableHead>
                    <TableHead className={cn('px-3', 'max-w-32')}>No. HP</TableHead>
                    <TableHead className="px-3">Type</TableHead>
                    <TableHead className="px-3">Bitrix ID</TableHead>
                    <TableHead className="px-3">Status</TableHead>
                    <TableHead className="px-3">Notes</TableHead>
                    <TableHead className="px-3">Updated By</TableHead>
                    <TableHead className="px-3">Updated At</TableHead>
                    <TableHead className={cn('px-3', 'w-20')}></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((customer) => (
                    <TableRow key={customer.id} className={cn("hover:bg-muted/30", selectedIds.has(customer.id) && "bg-muted/50")}>
                      <TableCell className="px-3">
                        <Checkbox checked={selectedIds.has(customer.id)} onCheckedChange={() => toggleOne(customer.id)} aria-label={`Select ${customer.name}`} />
                      </TableCell>
                      <TableCell className={cn('px-3', 'max-w-45', 'truncate', 'font-medium')} title={customer.name}>{customer.name}</TableCell>
                      <TableCell className={cn('px-3', 'max-w-32', 'overflow-hidden')}>
                        <Tooltip>
                          <TooltipTrigger className={cn('block', 'truncate', 'w-full', 'text-left')}>
                            {formatMobileNumbers(customer.mobileNumber)}
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="max-w-72">
                            <ul className="space-y-1">
                              {parseMobileNumbers(customer.mobileNumber).map((e, i) => (
                                <li key={i} className="text-sm">
                                  {e.name ? <><span className="text-muted-foreground">{e.name}:</span> {e.number}</> : e.number}
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-3">{customer.type}</TableCell>
                      <TableCell className="px-3">
                        {customer.bitrixId ? (
                          <button type="button" className={cn('flex', 'items-center', 'gap-1', 'group')} onClick={() => { navigator.clipboard.writeText(customer.bitrixId!); toast.success("Bitrix ID copied!"); }}>
                            <Badge variant="secondary" className={cn('font-mono', 'text-xs')}>{customer.bitrixId}</Badge>
                            <Copy weight="BoldDuotone" className={cn('h-3', 'w-3', 'text-muted-foreground', 'opacity-0', 'group-hover:opacity-100', 'transition-opacity')} />
                          </button>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="px-3">
                        <Badge variant="outline" className={cn("text-xs", MEMBER_STATUS_COLORS[customer.memberStatus] ?? "")}>
                          {customer.memberStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn('px-3', 'max-w-37.5', 'truncate', 'text-muted-foreground')} title={customer.notes ?? ""}>{customer.notes || "—"}</TableCell>
                      <TableCell className={cn('px-3', 'text-muted-foreground')}>{customer.updatedBy || "—"}</TableCell>
                      <TableCell className={cn('px-3', 'text-muted-foreground', 'whitespace-nowrap')}>{format(new Date(customer.updatedAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="px-3">
                        <div className={cn('flex', 'items-center', 'gap-1')}>
                          <PermissionGate module="customers" action="edit">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                              <Pen weight="BoldDuotone" className={cn('h-4', 'w-4')} />
                            </Button>
                          </PermissionGate>
                          <PermissionGate module="customers" action="delete">
                            <Button variant="ghost" size="icon" className={cn('text-destructive', 'hover:text-destructive', 'hover:bg-destructive/10')} onClick={() => setDeleteTarget(customer)}>
                              <TrashBinTrash weight="BoldDuotone" className={cn('h-4', 'w-4')} />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Navigasi halaman customer"
              className={cn('flex', 'flex-col', 'gap-3', 'px-4', 'sm:px-6', 'py-4', 'border-t', 'sm:flex-row', 'sm:justify-between', 'sm:items-center')}
            >
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-2')} /> Previous
              </Button>
              {/* Mobile: page X / Y */}
              <span className="text-sm text-muted-foreground text-center sm:hidden">
                {currentPage} / {totalPages}
              </span>
              {/* Desktop: numbered pages */}
              <div className={cn('hidden', 'sm:flex', 'items-center', 'gap-1', 'overflow-x-auto', 'justify-center')}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm font-medium cursor-pointer",
                      currentPage === page ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                    )}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                Next <ArrowRight weight="BoldDuotone" className={cn('w-4', 'h-4', 'ml-2')} />
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      <CustomerDrawer open={drawerOpen} onOpenChange={handleDrawerClose} editCustomer={editCustomer} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget?.name}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedIds.size} customer? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleteMut.isPending} className={cn('bg-destructive', 'text-destructive-foreground', 'hover:bg-destructive/90')}>
              {bulkDeleteMut.isPending ? "Menghapus..." : "Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
