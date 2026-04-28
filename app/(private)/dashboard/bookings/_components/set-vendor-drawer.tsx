"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSelect } from "@/components/shared/multi-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useVendorCategories } from "@/hooks/use-vendors";
import { saveBookingVendors, updateSnapBonus, addSnapBonus, deleteSnapBonus } from "@/actions/booking-vendor";
import { createOrderStatus } from "@/actions/order-status";
import type { BookingListItem } from "@/lib/queries/bookings";

const ALLOWED = ["catering", "decoration", "dekorasi", "rias", "photography", "entertainment", "mc"];

interface OrderStatusOption { id: string; name: string }

interface VendorState {
  vendorId: string;
  nominal: string;
  description: string;
  orderStatusId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  booking: BookingListItem | null;
  onSaved?: () => void;
}

function fmtRp(val: string) {
  const num = val.replace(/\D/g, "");
  return num ? new Intl.NumberFormat("id-ID").format(Number(num)) : "";
}

type SnapBonusItem = {
  id: string;
  vendorId: string;
  vendorCategoryId: string;
  vendorName: string;
  description?: string | null;
  nominal?: number | null;
  orderStatusId?: string | null;
  orderStatus?: { name: string } | null;
};

export function SetVendorDrawer({ open, onClose, booking, onSaved }: Props) {
  const { data: categories = [], isLoading } = useVendorCategories();
  const [selected, setSelected] = useState<Record<string, VendorState>>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  const handleAddOrderStatus = async (name: string) => {
    const result = await createOrderStatus(name);
    if (!result.success) { toast.error(result.error); return; }
    qc.setQueryData<OrderStatusOption[]>(["order-statuses"], (prev) => [...(prev ?? []), { id: result.item.id, name: result.item.name }]);
  };

  const { data: orderStatuses = [] } = useQuery<OrderStatusOption[]>({
    queryKey: ["order-statuses"],
    queryFn: () => fetch("/api/order-statuses").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: vendorCats = [] } = useQuery<{ id: string; name: string; vendors: { id: string; name: string }[] }[]>({
    queryKey: ["vendors-for-bonus"],
    queryFn: () => fetch("/api/vendors").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const allVendors = vendorCats.flatMap((c) => c.vendors.map((v) => ({ id: v.id, name: v.name, categoryId: c.id })));

  const cats = useMemo(() => {
    return categories
      .filter((c: typeof categories[number]) => ALLOWED.some((a) => c.name.toLowerCase().includes(a)))
      .sort((a, b) => {
        const ai = ALLOWED.findIndex((k) => a.name.toLowerCase().includes(k));
        const bi = ALLOWED.findIndex((k) => b.name.toLowerCase().includes(k));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [categories]);

  const [complimentary, setComplimentary] = useState<SnapBonusItem[]>([]);
  const [bonusEdits, setBonusEdits] = useState<Record<string, { nominal: string; description: string; orderStatusId: string }>>({});
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open || !booking) return;
    setLoadingDetail(true);
    fetch(`/api/bookings/${booking.id}`)
      .then((r) => r.json())
      .then((data) => {
        const items = data?.snapVendorItems ?? [];
        const sel: Record<string, VendorState> = {};
        for (const item of items) {
          if (!item.isAddons && item.vendorCategoryId) {
            sel[item.vendorCategoryId] = {
              vendorId: item.vendorId,
              nominal: item.itemPrice ? String(item.itemPrice) : "",
              description: item.description ?? "",
              orderStatusId: item.orderStatusId ?? "",
            };
          }
        }
        setSelected(sel);
        setComplimentary(data?.snapBonuses ?? []);
        const edits: Record<string, { nominal: string; description: string; orderStatusId: string }> = {};
        for (const b of (data?.snapBonuses ?? [])) {
          edits[b.id] = { nominal: b.nominal ? String(b.nominal) : "", description: b.description ?? "", orderStatusId: b.orderStatusId ?? "" };
        }
        setBonusEdits(edits);
        setLoadingDetail(false);
      })
      .catch(() => { setSelected({}); setComplimentary([]); setLoadingDetail(false); });
  }, [open, booking]);

  function updateField(catId: string, field: keyof VendorState, value: string) {
    setSelected((p) => ({ ...p, [catId]: { ...(p[catId] ?? { vendorId: "", nominal: "", description: "", orderStatusId: "" }), [field]: value } }));
  }

  const handleSave = async () => {
    if (!booking) return;
    setSaving(true);
    const selections = cats
      .filter((cat) => selected[cat.id]?.vendorId)
      .map((cat) => {
        const s = selected[cat.id];
        return {
          vendorCategoryId: cat.id,
          vendorCategoryName: cat.name,
          vendorId: s.vendorId,
          vendorName: cat.vendors.find((v) => v.id === s.vendorId)?.name ?? "",
          nominal: Number(s.nominal.replace(/\D/g, "")) || 0,
          description: s.description || undefined,
          orderStatusId: s.orderStatusId || null,
        };
      });
    const result = await saveBookingVendors(booking.id, selections);
    if (!result.success) { toast.error(result.error); setSaving(false); return; }

    // Save bonus edits
    await Promise.all(
      complimentary.map((b) => {
        const e = bonusEdits[b.id];
        if (!e) return Promise.resolve();
        return updateSnapBonus(b.id, {
          vendorId: b.vendorId || undefined,
          vendorName: b.vendorName || undefined,
          nominal: Number(e.nominal.replace(/\D/g, "")) || 0,
          description: e.description || undefined,
          orderStatusId: e.orderStatusId || null,
        });
      })
    );

    toast.success("Vendor berhasil diupdate"); onSaved?.();
    setSaving(false);
  };

  const saveBtn = (
    <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 px-3 text-xs">
      <Save className="h-3.5 w-3.5 mr-1" />
      {saving ? "Menyimpan..." : "Simpan"}
    </Button>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={`Set Vendor — ${booking?.snapCustomer?.name ?? "-"}`}
      maxWidth="max-w-full"
      headerActions={saveBtn}
    >
      {(isLoading || loadingDetail) ? (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-4 w-[180px]">Kategori</TableHead>
                <TableHead className="px-4 min-w-[220px]">Nama Vendor</TableHead>
                <TableHead className="px-4 w-[180px]">Nominal</TableHead>
                <TableHead className="px-4 min-w-[200px]">Keterangan</TableHead>
                <TableHead className="px-4 w-[180px]">Status Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="px-4"><Skeleton className="h-9 w-full" /></TableCell>
                  <TableCell className="px-4"><Skeleton className="h-9 w-full" /></TableCell>
                  <TableCell className="px-4"><Skeleton className="h-9 w-full" /></TableCell>
                  <TableCell className="px-4"><Skeleton className="h-9 w-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-4 w-[180px]">Kategori</TableHead>
                <TableHead className="px-4 min-w-[220px]">Nama Vendor</TableHead>
                <TableHead className="px-4 w-[180px]">Nominal</TableHead>
                <TableHead className="px-4 min-w-[200px]">Keterangan</TableHead>
                <TableHead className="px-4 w-[180px]">Status Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Vendor rows */}
              {cats.map((cat) => {
                const state = selected[cat.id] ?? { vendorId: "", nominal: "", description: "", orderStatusId: "" };
                return (
                  <TableRow key={cat.id}>
                    <TableCell className="px-4 font-medium text-sm text-gray-700 align-middle">{cat.name}</TableCell>
                    <TableCell className="px-4 align-middle">
                      {state.vendorId ? (
                        <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2 gap-2">
                          <span className="text-sm truncate flex-1">{cat.vendors.find((v) => v.id === state.vendorId)?.name}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => updateField(cat.id, "vendorId", "")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <SearchableSelect
                          options={cat.vendors.map((v) => ({ id: v.id, name: v.name }))}
                          value=""
                          onChange={(v) => updateField(cat.id, "vendorId", v)}
                          placeholder="Pilih vendor..."
                          searchPlaceholder="Cari vendor..."
                          emptyText="Tidak ada vendor"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                        <Input
                          className="pl-8 text-sm"
                          placeholder="0"
                          value={fmtRp(state.nominal)}
                          onChange={(e) => updateField(cat.id, "nominal", e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <Input
                        className="text-sm"
                        placeholder="Catatan..."
                        value={state.description}
                        onChange={(e) => updateField(cat.id, "description", e.target.value)}
                      />
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <SearchableSelect
                        options={orderStatuses}
                        value={state.orderStatusId}
                        onChange={(v) => updateField(cat.id, "orderStatusId", v)}
                        onAdd={handleAddOrderStatus}
                        placeholder="Pilih status..."
                        searchPlaceholder="Cari atau tambah status..."
                        emptyText="Tidak ada status"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* Separator + add bonus button */}
              <TableRow className="bg-gray-50">
                <TableCell colSpan={4} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Complimentary / Bonus
                </TableCell>
                <TableCell className="px-4 py-2 text-right">
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    disabled={saving}
                    onClick={async () => {
                      if (!booking) return;
                      const result = await addSnapBonus(booking.id, { vendorId: "", vendorCategoryId: "", vendorName: "—" });
                      if (result.success) {
                        setComplimentary((p) => [...p, result.item as unknown as SnapBonusItem]);
                        setBonusEdits((p) => ({ ...p, [result.item.id]: { nominal: "", description: "", orderStatusId: "" } }));
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Tambah Bonus
                  </Button>
                </TableCell>
              </TableRow>

              {/* Bonus rows */}
              {complimentary.map((b) => {
                const e = bonusEdits[b.id] ?? { nominal: "", description: "", orderStatusId: "" };
                return (
                  <TableRow key={b.id}>
                    <TableCell className="px-4 font-medium text-sm text-gray-700 align-middle">Complimentary</TableCell>
                    <TableCell className="px-4 align-middle">
                      {b.vendorId ? (
                        <div className="flex items-center justify-between bg-muted rounded-md px-3 py-2 gap-2">
                          <span className="text-sm truncate flex-1">{allVendors.find((v) => v.id === b.vendorId)?.name ?? b.vendorName}</span>
                          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive shrink-0"
                            onClick={() => setComplimentary((p) => p.map((x) => x.id === b.id ? { ...x, vendorId: "", vendorName: "" } : x))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <SearchableSelect
                          options={allVendors.filter((v) => !complimentary.some((x) => x.id !== b.id && x.vendorId === v.id)).map((v) => ({ id: v.id, name: v.name }))}
                          value=""
                          onChange={async (vendorId) => {
                            const v = allVendors.find((x) => x.id === vendorId);
                            if (!v) return;
                            setComplimentary((p) => p.map((x) => x.id === b.id ? { ...x, vendorId: v.id, vendorCategoryId: v.categoryId, vendorName: v.name } : x));
                          }}
                          placeholder="Pilih vendor..."
                          searchPlaceholder="Cari vendor..."
                          emptyText="Tidak ada vendor"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Rp</span>
                        <Input className="pl-8 text-sm" placeholder="0"
                          value={fmtRp(e.nominal)}
                          onChange={(ev) => setBonusEdits((p) => ({ ...p, [b.id]: { ...e, nominal: ev.target.value.replace(/\D/g, "") } }))}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <Input className="text-sm" placeholder="Catatan..."
                        value={e.description}
                        onChange={(ev) => setBonusEdits((p) => ({ ...p, [b.id]: { ...e, description: ev.target.value } }))}
                      />
                    </TableCell>
                    <TableCell className="px-4 align-middle">
                      <div className="flex items-center gap-2">
                        <SearchableSelect
                          options={orderStatuses}
                          value={e.orderStatusId}
                          onChange={(v) => setBonusEdits((p) => ({ ...p, [b.id]: { ...e, orderStatusId: v } }))}
                          onAdd={handleAddOrderStatus}
                          placeholder="Pilih status..."
                          searchPlaceholder="Cari atau tambah status..."
                          emptyText="Tidak ada status"
                        />
                        <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-700 shrink-0"
                          onClick={async () => {
                            const result = await deleteSnapBonus(b.id);
                            if (result.success) {
                              setComplimentary((p) => p.filter((x) => x.id !== b.id));
                              setBonusEdits((p) => { const n = { ...p }; delete n[b.id]; return n; });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Drawer>
  );
}
