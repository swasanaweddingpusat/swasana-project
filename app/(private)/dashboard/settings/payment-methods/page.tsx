"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCircle, PenNewSquare, TrashBinTrash, Card as CardIcon, Refresh } from "@solar-icons/react";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePermissions } from "@/hooks/use-permissions";
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from "@/actions/payment-method";
import { cn } from "../../../../../lib/utils";

type PaymentMethodItem = {
  id: string;
  venueId: string | null;
  bankName: string;
  bankAccountNumber: string;
  bankRecipient: string;
  createdAt: Date;
  venue: { id: string; name: string } | null;
};

type VenueOption = { id: string; name: string };

const ROWS_PER_PAGE = 10;

export default function PaymentMethodsPage() {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState<PaymentMethodItem[]>([]);
  const [total, setTotal] = useState(0);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [venueFilter, setVenueFilter] = useState("all");

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PaymentMethodItem | null>(null);
  const [formData, setFormData] = useState({ venueId: "", bankName: "", bankAccountNumber: "", bankRecipient: "" });
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<PaymentMethodItem | null>(null);

  const fetchItems = useCallback(async (page: number, venueId: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(ROWS_PER_PAGE) });
      if (venueId !== "all") params.set("venueId", venueId);
      const [pmRes, venueRes] = await Promise.all([
        fetch(`/api/payment-methods?${params.toString()}`),
        fetch("/api/venues"),
      ]);
      if (!pmRes.ok) throw new Error();
      const pmJson = await pmRes.json() as { data: PaymentMethodItem[]; total: number; page: number; limit: number };
      setItems(pmJson.data ?? []);
      setTotal(pmJson.total ?? 0);
      if (venueRes.ok) {
        const venueData: VenueOption[] = await venueRes.json() as VenueOption[];
        setVenues(venueData);
      }
    } catch {
      toast.error("Failed to fetch payment methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchItems(currentPage, venueFilter); }, [fetchItems, currentPage, venueFilter]);

  const totalPages = Math.ceil(total / ROWS_PER_PAGE);
  const paginated = items;

  const openAdd = () => {
    setEditingItem(null);
    setFormData({ venueId: "", bankName: "", bankAccountNumber: "", bankRecipient: "" });
    setFormOpen(true);
  };

  const openEdit = (item: PaymentMethodItem) => {
    setEditingItem(item);
    setFormData({ venueId: item.venueId ?? "", bankName: item.bankName, bankAccountNumber: item.bankAccountNumber, bankRecipient: item.bankRecipient });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formData.venueId || !formData.bankName.trim() || !formData.bankAccountNumber.trim() || !formData.bankRecipient.trim()) {
      toast.error("Semua field wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = editingItem
        ? await updatePaymentMethod(editingItem.id, formData)
        : await createPaymentMethod(formData);
      if (res.success) {
        toast.success(editingItem ? "Payment method updated" : "Payment method added");
        setFormOpen(false);
        void fetchItems(currentPage, venueFilter);
      } else {
        toast.error(res.error ?? "Failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const res = await deletePaymentMethod(itemToDelete.id);
    if (res.success) {
      toast.success("Deleted");
      setDeleteOpen(false);
      setItemToDelete(null);
      void fetchItems(currentPage, venueFilter);
    } else {
      toast.error(res.error ?? "Failed");
    }
  };

  if (loading) {
    return (
      <div className={cn('px-2', 'pb-6')}>
        <Card className="shadow-none">
          <CardContent className="p-0">
            <div className={cn('flex', 'justify-between', 'items-center', 'px-4', 'sm:px-6', 'pb-4', 'border-b')}>
              <div className={cn('flex', 'items-center', 'gap-2')}>
                <Skeleton className={cn('h-5', 'w-36')} />
                <Skeleton className={cn('h-4', 'w-8')} />
              </div>
              <div className={cn('flex', 'items-center', 'gap-3')}>
                <Skeleton className={cn('h-9', 'w-50')} />
                <Skeleton className={cn('h-9', 'w-40')} />
              </div>
            </div>
            <div className="px-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn('flex', 'items-center', 'gap-4', 'py-3', 'border-b', 'last:border-0')}>
                  <Skeleton className={cn('h-4', 'w-8')} />
                  <Skeleton className={cn('h-4', 'w-28')} />
                  <Skeleton className={cn('h-4', 'w-28')} />
                  <Skeleton className={cn('h-4', 'w-36')} />
                  <Skeleton className={cn('h-4', 'w-28')} />
                  <div className="flex-1" />
                  <div className={cn('flex', 'gap-1')}>
                    <Skeleton className={cn('h-7', 'w-7')} />
                    <Skeleton className={cn('h-7', 'w-7')} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn('px-2', 'pb-6')}>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn('flex', 'flex-col', 'sm:flex-row', 'justify-between', 'items-start', 'sm:items-center', 'px-4', 'sm:px-6', 'pb-4', 'gap-3', 'border-b')}>
            <div className={cn('flex', 'items-center', 'gap-2')}>
              <span className={cn('text-base', 'font-semibold', 'text-foreground')}>Payment Methods</span>
              <span className={cn('text-sm', 'text-muted-foreground')}>({total})</span>
            </div>
            <div className={cn('flex', 'flex-wrap', 'items-center', 'gap-2', 'w-full', 'sm:w-auto')}>
              <SearchableSelect
                options={[{ id: "all", name: "All Venues" }, ...venues]}
                value={venueFilter}
                onChange={(v) => { setVenueFilter(v); setCurrentPage(1); }}
                placeholder="All Venues"
                searchPlaceholder="Cari venue..."
                className="w-full sm:w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void fetchItems(currentPage, venueFilter); }}
                disabled={loading}
                className={cn('h-9', 'w-9', 'p-0', 'cursor-pointer', 'shrink-0')}
                aria-label="Refresh"
              >
                <Refresh weight="BoldDuotone" className={cn('w-4', 'h-4', loading && 'animate-spin')} />
              </Button>
              {(can("settings-payment-methods", "create") || isAdmin) && (
                <Button onClick={openAdd} className="shrink-0">
                  <AddCircle weight="BoldDuotone" className={cn('w-4', 'h-4', 'mr-1')} /> Add Payment Method
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          {!loading && total === 0 ? (
            <div className={cn('flex', 'flex-col', 'items-center', 'py-12', 'text-muted-foreground')}>
              <CardIcon weight="BoldDuotone" className={cn('h-12', 'w-12', 'mb-3', 'opacity-30')} />
              <p>No payment methods yet</p>
            </div>
          ) : (
            <>
            {/* Mobile: card list (<sm) */}
            <div className="block sm:hidden px-3 py-2 space-y-2">
              {paginated.map((item, idx) => (
                <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                  <CardContent className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {(currentPage - 1) * ROWS_PER_PAGE + idx + 1}. {item.bankName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{item.venue?.name ?? "-"}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(can("settings-payment-methods", "edit") || isAdmin) && (
                          <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => openEdit(item)} aria-label="Edit">
                            <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                          </button>
                        )}
                        {(can("settings-payment-methods", "delete") || isAdmin) && (
                          <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setItemToDelete(item); setDeleteOpen(true); }} aria-label="Hapus">
                            <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                      <p>No. Rek: <span className="text-foreground">{item.bankAccountNumber}</span></p>
                      <p>a.n: <span className="text-foreground">{item.bankRecipient}</span></p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop/tablet: table (sm+) */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-14">No</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Account Number</TableHead>
                    <TableHead className="hidden md:table-cell">Account Holder</TableHead>
                    <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell>{item.venue?.name ?? "-"}</TableCell>
                      <TableCell>{item.bankName}</TableCell>
                      <TableCell className="hidden sm:table-cell">{item.bankAccountNumber}</TableCell>
                      <TableCell className="hidden md:table-cell">{item.bankRecipient}</TableCell>
                      <TableCell>
                        <div className={cn('flex', 'gap-1', 'justify-end', 'pr-2')}>
                          {(can("settings-payment-methods", "edit") || isAdmin) && (
                            <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => openEdit(item)}>
                              <PenNewSquare weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-muted-foreground')} />
                            </button>
                          )}
                          {(can("settings-payment-methods", "delete") || isAdmin) && (
                            <button className={cn('p-1.5', 'hover:bg-muted', 'rounded', 'cursor-pointer')} onClick={() => { setItemToDelete(item); setDeleteOpen(true); }}>
                              <TrashBinTrash weight="BoldDuotone" className={cn('w-4', 'h-4', 'text-destructive')} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}

          {/* Pagination */}
          {total > 0 && totalPages > 1 && (
            <PaginationBar
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              label="Navigasi halaman payment method"
            />
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
          <div className={cn('space-y-3', 'mt-2')}>
            <div>
              <Label className="text-sm">Venue *</Label>
              <SearchableSelect
                options={venues}
                value={formData.venueId}
                onChange={(v) => setFormData((p) => ({ ...p, venueId: v }))}
                placeholder="Pilih venue"
                searchPlaceholder="Cari venue..."
                className="mt-1 w-full"
              />
            </div>
            <div>
              <Label className="text-sm">Bank Name *</Label>
              <Input className="mt-1" value={formData.bankName} onChange={(e) => setFormData((p) => ({ ...p, bankName: e.target.value }))} placeholder="BCA, Mandiri, dll" />
            </div>
            <div>
              <Label className="text-sm">Account Number *</Label>
              <Input className="mt-1" value={formData.bankAccountNumber} onChange={(e) => setFormData((p) => ({ ...p, bankAccountNumber: e.target.value }))} placeholder="1234567890" />
            </div>
            <div>
              <Label className="text-sm">Account Holder *</Label>
              <Input className="mt-1" value={formData.bankRecipient} onChange={(e) => setFormData((p) => ({ ...p, bankRecipient: e.target.value }))} placeholder="Nama pemilik rekening" />
            </div>
          </div>
          <div className={cn('flex', 'gap-2', 'mt-4')}>
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Delete Payment Method</DialogTitle>
          <p className={cn('text-sm', 'text-muted-foreground')}>Are you sure? This action cannot be undone.</p>
          <div className={cn('flex', 'gap-2', 'mt-4')}>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
