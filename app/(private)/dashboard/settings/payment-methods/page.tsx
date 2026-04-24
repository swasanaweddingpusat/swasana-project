"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, PenLine, Trash2, ArrowLeft, ArrowRight, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePermissions } from "@/hooks/use-permissions";
import { createPaymentMethod, updatePaymentMethod, deletePaymentMethod } from "@/actions/payment-method";

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

const rowsPerPage = 10;

export default function PaymentMethodsPage() {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState<PaymentMethodItem[]>([]);
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

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const [pmRes, venueRes] = await Promise.all([
        fetch("/api/payment-methods"),
        fetch("/api/venues"),
      ]);
      if (!pmRes.ok) throw new Error();
      const data: PaymentMethodItem[] = await pmRes.json();
      setItems(data);
      if (venueRes.ok) {
        const venueData: VenueOption[] = await venueRes.json();
        setVenues(venueData);
      }
    } catch {
      toast.error("Failed to fetch payment methods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = venueFilter === "all" ? items : items.filter((i) => i.venueId === venueFilter);
  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const paginated = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

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
        fetchItems();
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
      fetchItems();
    } else {
      toast.error(res.error ?? "Failed");
    }
  };

  if (loading) {
    return (
      <div className="px-2 pb-6">
        <Card className="shadow-none"><CardContent className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 py-3">
              <Skeleton className="h-4 w-8" /><Skeleton className="h-4 w-48" /><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-32" />
            </div>
          ))}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="px-2 pb-6">
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex justify-between items-center px-6 pb-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-gray-900">Payment Methods</span>
              <span className="text-sm text-muted-foreground">({filtered.length})</span>
            </div>
            <div className="flex items-center gap-3">
              <SearchableSelect
                options={[{ id: "all", name: "All Venues" }, ...venues]}
                value={venueFilter}
                onChange={(v) => { setVenueFilter(v); setCurrentPage(1); }}
                placeholder="All Venues"
                searchPlaceholder="Cari venue..."
                className="w-50"
              />
              {(can("payment_methods", "create") || isAdmin) && (
                <Button onClick={openAdd}>
                  <Plus className="w-4 h-4 mr-1" /> Add Payment Method
                </Button>
              )}
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-3 opacity-30" />
              <p>No payment methods yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-14">No</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Bank Name</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">{(currentPage - 1) * rowsPerPage + idx + 1}</TableCell>
                    <TableCell>{item.venue?.name ?? "-"}</TableCell>
                    <TableCell>{item.bankName}</TableCell>
                    <TableCell>{item.bankAccountNumber}</TableCell>
                    <TableCell>{item.bankRecipient}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {(can("payment_methods", "edit") || isAdmin) && (
                          <button className="p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => openEdit(item)}>
                            <PenLine className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        {(can("payment_methods", "delete") || isAdmin) && (
                          <button className="p-1.5 hover:bg-muted rounded cursor-pointer" onClick={() => { setItemToDelete(item); setDeleteOpen(true); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-3 border-t">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{editingItem ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
          <div className="space-y-3 mt-2">
            <div>
              <Label className="text-sm">Venue *</Label>
              <Select value={formData.venueId} onValueChange={(v) => setFormData((p) => ({ ...p, venueId: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          <div className="flex gap-2 mt-4">
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
          <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
