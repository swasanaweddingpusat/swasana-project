"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCircle, PenNewSquare, TrashBinTrash, Document, Refresh } from "@solar-icons/react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { usePermissions } from "@/hooks/use-permissions";
import { upsertQuotationTemplate, deleteQuotationTemplate } from "@/actions/quotation-template";
import { cn } from "@/lib/utils";

type TemplateListItem = {
  id: string;
  venueId: string;
  paymentMethodId: string | null;
  updatedAt: string;
  venue: { id: string; name: string };
  paymentMethod: { id: string; bankName: string; bankRecipient: string } | null;
  _count: { items: number };
};

type VenueOption = { id: string; name: string };

type ItemRow = {
  title: string;
  description: string;
  qty: number;
  price: number;
  total: number;
  manualTotal: boolean;
};

type TemplateDetail = {
  items: {
    title: string;
    description: string | null;
    qty: number;
    price: number;
    total: number;
    manualTotal: boolean;
    sortOrder: number;
  }[];
  paymentMethodId: string | null;
  bookingFee: number | null;
};

const emptyRow = (): ItemRow => ({ title: "", description: "", qty: 1, price: 0, total: 0, manualTotal: false });

const formatNumber = (n: number): string => (n > 0 ? n.toLocaleString("id-ID") : "");
const parseNumber = (v: string): number => {
  const digits = v.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : 0;
};

export default function QuotationTemplatesPage() {
  const { can, isAdmin } = usePermissions();
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateListItem | null>(null);
  const [venueId, setVenueId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [bookingFee, setBookingFee] = useState(0);
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [prefilling, setPrefilling] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<TemplateListItem | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const [tplRes, venueRes] = await Promise.all([
        fetch("/api/quotation-templates"),
        fetch("/api/venues"),
      ]);
      if (!tplRes.ok) throw new Error();
      const tplJson = (await tplRes.json()) as { data: TemplateListItem[] };
      setItems(tplJson.data ?? []);
      if (venueRes.ok) {
        const venueData = (await venueRes.json()) as VenueOption[];
        setVenues(venueData);
      }
    } catch {
      toast.error("Gagal memuat template quotation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const openAdd = () => {
    setEditing(null);
    setVenueId("");
    setPaymentMethodId(null);
    setBookingFee(0);
    setRows([emptyRow()]);
    setFormOpen(true);
  };

  const loadTemplateDetail = useCallback(async (vid: string) => {
    setPrefilling(true);
    try {
      const res = await fetch(`/api/quotation-templates/${vid}`);
      if (!res.ok) {
        setRows([emptyRow()]);
        setPaymentMethodId(null);
        setBookingFee(0);
        return;
      }
      const detail = (await res.json()) as TemplateDetail;
      if (detail.items.length > 0) {
        setRows(
          detail.items.map((it) => ({
            title: it.title,
            description: it.description ?? "",
            qty: it.qty,
            price: it.price,
            total: it.total,
            manualTotal: it.manualTotal,
          })),
        );
      } else {
        setRows([emptyRow()]);
      }
      setPaymentMethodId(detail.paymentMethodId);
      setBookingFee(detail.bookingFee ?? 0);
    } catch {
      setRows([emptyRow()]);
      setPaymentMethodId(null);
      setBookingFee(0);
    } finally {
      setPrefilling(false);
    }
  }, []);

  const openEdit = (item: TemplateListItem) => {
    setEditing(item);
    setVenueId(item.venueId);
    setPaymentMethodId(item.paymentMethodId);
    setRows([emptyRow()]);
    setFormOpen(true);
    void loadTemplateDetail(item.venueId);
  };

  const handleVenueChange = (vid: string) => {
    setVenueId(vid);
    setPaymentMethodId(null);
    setBookingFee(0);
    if (vid) {
      void loadTemplateDetail(vid);
    } else {
      setRows([emptyRow()]);
    }
  };

  const updateRow = (index: number, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        if (!next.manualTotal && (patch.qty !== undefined || patch.price !== undefined)) {
          next.total = next.qty * next.price;
        }
        return next;
      }),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!venueId) {
      toast.error("Venue wajib dipilih");
      return;
    }
    const cleanRows = rows.filter((r) => r.title.trim());
    if (cleanRows.length === 0) {
      toast.error("Minimal satu item dengan judul wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const res = await upsertQuotationTemplate({
        venueId,
        paymentMethodId: paymentMethodId ?? undefined,
        bookingFee: bookingFee > 0 ? bookingFee : undefined,
        items: cleanRows.map((r, idx) => ({
          title: r.title.trim(),
          description: r.description || undefined,
          qty: r.qty,
          price: r.price,
          total: r.total,
          manualTotal: r.manualTotal,
          sortOrder: idx,
        })),
      });
      if (res.success) {
        toast.success(editing ? "Template diperbarui" : "Template ditambahkan");
        setFormOpen(false);
        void fetchItems();
      } else {
        toast.error(res.error ?? "Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const res = await deleteQuotationTemplate(toDelete.id);
    if (res.success) {
      toast.success("Template dihapus");
      setDeleteOpen(false);
      setToDelete(null);
      void fetchItems();
    } else {
      toast.error(res.error ?? "Gagal menghapus");
    }
  };

  if (loading) {
    return (
      <div className={cn("px-2", "pb-6")}>
        <Card className="shadow-none">
          <CardContent className="p-0">
            <div className={cn("flex", "justify-between", "items-center", "px-4", "sm:px-6", "pb-4", "border-b")}>
              <div className={cn("flex", "items-center", "gap-2")}>
                <Skeleton className={cn("h-5", "w-44")} />
                <Skeleton className={cn("h-4", "w-8")} />
              </div>
              <Skeleton className={cn("h-9", "w-40")} />
            </div>
            <div className="px-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={cn("flex", "items-center", "gap-4", "py-3", "border-b", "last:border-0")}>
                  <Skeleton className={cn("h-4", "w-8")} />
                  <Skeleton className={cn("h-4", "w-36")} />
                  <Skeleton className={cn("h-4", "w-16")} />
                  <Skeleton className={cn("h-4", "w-32")} />
                  <div className="flex-1" />
                  <div className={cn("flex", "gap-1")}>
                    <Skeleton className={cn("h-7", "w-7")} />
                    <Skeleton className={cn("h-7", "w-7")} />
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
    <div className={cn("px-2", "pb-6")}>
      <Card className="shadow-none">
        <CardContent className="p-0">
          {/* Header */}
          <div className={cn("flex", "flex-col", "sm:flex-row", "justify-between", "items-start", "sm:items-center", "px-4", "sm:px-6", "pb-4", "gap-3", "border-b")}>
            <div className={cn("flex", "items-center", "gap-2")}>
              <span className={cn("text-base", "font-semibold", "text-foreground")}>Quotation Templates</span>
              <span className={cn("text-sm", "text-muted-foreground")}>({items.length})</span>
            </div>
            <div className={cn("flex", "flex-wrap", "items-center", "gap-2", "w-full", "sm:w-auto")}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void fetchItems(); }}
                disabled={loading}
                className={cn("h-9", "w-9", "p-0", "cursor-pointer", "shrink-0")}
                aria-label="Refresh"
              >
                <Refresh weight="BoldDuotone" className={cn("w-4", "h-4", loading && "animate-spin")} />
              </Button>
              {(can("settings-quotation-templates", "create") || isAdmin) && (
                <Button onClick={openAdd} className="shrink-0">
                  <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-1")} /> Tambah Template
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          {items.length === 0 ? (
            <div className={cn("flex", "flex-col", "items-center", "py-12", "text-muted-foreground")}>
              <Document weight="BoldDuotone" className={cn("h-12", "w-12", "mb-3", "opacity-30")} />
              <p>Belum ada template quotation</p>
            </div>
          ) : (
            <>
              {/* Mobile: card list (<sm) */}
              <div className="block sm:hidden px-3 py-2 space-y-2">
                {items.map((item, idx) => (
                  <Card key={item.id} className="rounded-lg border bg-card shadow-none">
                    <CardContent className="px-3 py-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {idx + 1}. {item.venue.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{item._count.items} item</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(can("settings-quotation-templates", "edit") || isAdmin) && (
                            <button className={cn("p-1.5", "hover:bg-muted", "rounded", "cursor-pointer")} onClick={() => openEdit(item)} aria-label="Edit">
                              <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                            </button>
                          )}
                          {(can("settings-quotation-templates", "delete") || isAdmin) && (
                            <button className={cn("p-1.5", "hover:bg-muted", "rounded", "cursor-pointer")} onClick={() => { setToDelete(item); setDeleteOpen(true); }} aria-label="Hapus">
                              <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                        <p>Rekening: <span className="text-foreground">{item.paymentMethod ? `${item.paymentMethod.bankName} — ${item.paymentMethod.bankRecipient}` : "-"}</span></p>
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
                      <TableHead className="w-24"># Item</TableHead>
                      <TableHead className="hidden md:table-cell">Payment Method</TableHead>
                      <TableHead className="w-24 text-right pr-6">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>{item.venue.name}</TableCell>
                        <TableCell>{item._count.items}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {item.paymentMethod ? `${item.paymentMethod.bankName} — ${item.paymentMethod.bankRecipient}` : "-"}
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex", "gap-1", "justify-end", "pr-2")}>
                            {(can("settings-quotation-templates", "edit") || isAdmin) && (
                              <button className={cn("p-1.5", "hover:bg-muted", "rounded", "cursor-pointer")} onClick={() => openEdit(item)}>
                                <PenNewSquare weight="BoldDuotone" className={cn("w-4", "h-4", "text-muted-foreground")} />
                              </button>
                            )}
                            {(can("settings-quotation-templates", "delete") || isAdmin) && (
                              <button className={cn("p-1.5", "hover:bg-muted", "rounded", "cursor-pointer")} onClick={() => { setToDelete(item); setDeleteOpen(true); }}>
                                <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
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
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>{editing ? "Edit Template Quotation" : "Tambah Template Quotation"}</DialogTitle>
          <div className={cn("space-y-4", "mt-2")}>
            <div>
              <Label className="text-sm">Venue *</Label>
              <SearchableSelect
                options={venues}
                value={venueId}
                onChange={handleVenueChange}
                placeholder="Pilih venue"
                searchPlaceholder="Cari venue..."
                disabled={!!editing}
                className="mt-1 w-full"
              />
              {editing && (
                <p className={cn("text-xs", "text-muted-foreground", "mt-1")}>Venue tidak bisa diubah saat edit.</p>
              )}
            </div>

            <div>
              <Label className="text-sm">Default Payment Method</Label>
              <BankAccountSelect
                value={paymentMethodId ?? undefined}
                onChange={(v) => setPaymentMethodId(v)}
                venueId={venueId || undefined}
                disableAdd
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm">Default Booking Fee</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                  Rp
                </span>
                <Input
                  inputMode="numeric"
                  value={formatNumber(bookingFee)}
                  onChange={(e) => setBookingFee(parseNumber(e.target.value))}
                  placeholder="0"
                  className="pl-8"
                />
              </div>
              <p className={cn("text-xs", "text-muted-foreground", "mt-1")}>
                Auto-terisi ke form quotation venue ini. Tampil di dokumen sebagai &quot;Booking
                Fee of Rp X is required to confirm the reservation&quot;.
              </p>
            </div>

            {/* Items editor */}
            <div className="space-y-3">
              <div className={cn("flex", "items-center", "justify-between")}>
                <Label className="text-sm">Item Template *</Label>
                {prefilling && <span className={cn("text-xs", "text-muted-foreground")}>Memuat...</span>}
              </div>

              <div className="space-y-3">
                {rows.map((row, index) => (
                  <div key={index} className={cn("rounded-xl", "border", "border-border", "bg-muted/30", "p-3", "space-y-3")}>
                    <div className={cn("flex", "items-start", "gap-2")}>
                      <div className="flex-1">
                        <Label className={cn("text-xs", "text-muted-foreground")}>Judul</Label>
                        <Input
                          className="mt-1"
                          value={row.title}
                          onChange={(e) => updateRow(index, { title: e.target.value })}
                          placeholder="Nama item"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        disabled={rows.length === 1}
                        className={cn("p-2", "mt-5", "hover:bg-muted", "rounded", "cursor-pointer", "disabled:opacity-40", "disabled:cursor-not-allowed")}
                        aria-label="Hapus item"
                      >
                        <TrashBinTrash weight="BoldDuotone" className={cn("w-4", "h-4", "text-destructive")} />
                      </button>
                    </div>

                    <div className={cn("grid", "grid-cols-3", "gap-2")}>
                      <div>
                        <Label className={cn("text-xs", "text-muted-foreground")}>Qty</Label>
                        <Input
                          className="mt-1"
                          inputMode="numeric"
                          value={row.qty === 0 ? "" : String(row.qty)}
                          onChange={(e) => updateRow(index, { qty: parseNumber(e.target.value) })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className={cn("text-xs", "text-muted-foreground")}>Harga</Label>
                        <Input
                          className="mt-1"
                          inputMode="numeric"
                          value={formatNumber(row.price)}
                          onChange={(e) => updateRow(index, { price: parseNumber(e.target.value) })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className={cn("text-xs", "text-muted-foreground")}>Total</Label>
                        <Input
                          className="mt-1"
                          inputMode="numeric"
                          value={formatNumber(row.total)}
                          onChange={(e) => updateRow(index, { total: parseNumber(e.target.value), manualTotal: true })}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className={cn("text-xs", "text-muted-foreground")}>Deskripsi (opsional)</Label>
                      <div className="mt-1">
                        <SimpleEditor
                          value={row.description}
                          onChange={(html) => updateRow(index, { description: html })}
                          placeholder="Deskripsi detail item..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addRow} className="w-full">
                <AddCircle weight="BoldDuotone" className={cn("w-4", "h-4", "mr-1")} /> Tambah Item
              </Button>
            </div>
          </div>

          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : editing ? "Perbarui" : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>Hapus Template Quotation</DialogTitle>
          <p className={cn("text-sm", "text-muted-foreground")}>
            Yakin ingin menghapus template untuk venue <span className="text-foreground font-medium">{toDelete?.venue.name}</span>? Tindakan ini tidak bisa dibatalkan.
          </p>
          <div className={cn("flex", "gap-2", "mt-4")}>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>Batal</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete}>Hapus</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
