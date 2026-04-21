"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useVendorCategories } from "@/hooks/use-vendors";
import { saveBookingVendors } from "@/actions/booking-vendor";
import type { BookingListItem } from "@/lib/queries/bookings";

const ALLOWED = ["catering", "decoration", "dekorasi", "rias", "photography", "entertainment", "mc"];

interface Props {
  open: boolean;
  onClose: () => void;
  booking: BookingListItem | null;
  onSaved?: () => void;
}

export function SetVendorDrawer({ open, onClose, booking, onSaved }: Props) {
  const { data: categories = [], isLoading } = useVendorCategories();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Filter & sort categories
  const cats = useMemo(() => {
    return categories
      .filter((c) => {
        const n = c.name.toLowerCase();
        return ALLOWED.some((a) => n.includes(a));
      })
      .sort((a, b) => {
        const ai = ALLOWED.findIndex((k) => a.name.toLowerCase().includes(k));
        const bi = ALLOWED.findIndex((k) => b.name.toLowerCase().includes(k));
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
  }, [categories]);

  // Load existing vendor selections from booking snapVendorItems
  useEffect(() => {
    if (!open || !booking) return;
    // Fetch snap vendor items for this booking
    fetch(`/api/bookings/${booking.id}`)
      .then((r) => r.json())
      .then((data) => {
        const items = data?.snapVendorItems ?? [];
        const sel: Record<string, string> = {};
        for (const item of items) {
          if (!item.isAddons && item.vendorCategoryId) {
            sel[item.vendorCategoryId] = item.vendorId;
          }
        }
        setSelected(sel);
      })
      .catch(() => setSelected({}));
  }, [open, booking]);

  const handleSave = async () => {
    if (!booking) return;
    setSaving(true);
    const selections = cats.map((cat) => ({
      vendorCategoryId: cat.id,
      vendorCategoryName: cat.name,
      vendorId: selected[cat.id] ?? "",
      vendorName: cat.vendors.find((v) => v.id === selected[cat.id])?.name ?? "",
    }));
    const result = await saveBookingVendors(booking.id, selections);
    if (!result.success) toast.error(result.error);
    else {
      toast.success("Vendor berhasil diupdate");
      onSaved?.();
      onClose();
    }
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
      maxWidth="sm:max-w-lg"
      headerActions={saveBtn}
    >
      {isLoading ? (
        <div className="py-8 text-center text-gray-500 text-sm">Memuat data...</div>
      ) : (
        <div className="space-y-4">
          {cats.map((cat) => {
            const vid = selected[cat.id] ?? "";
            const vendorObj = cat.vendors.find((v) => v.id === vid);
            return (
              <div key={cat.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm text-gray-900">{cat.name}</h4>
                {vid && vendorObj ? (
                  <div className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-2">
                    <span className="text-sm text-gray-800">{vendorObj.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      onClick={() => setSelected((p) => ({ ...p, [cat.id]: "" }))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <SearchableSelect
                    options={cat.vendors.map((v) => ({ id: v.id, name: v.name }))}
                    value=""
                    onChange={(v) => setSelected((p) => ({ ...p, [cat.id]: v }))}
                    placeholder="Pilih vendor..."
                    searchPlaceholder="Cari vendor..."
                    emptyText="Tidak ada vendor"
                  />
                )}
              </div>
            );
          })}

          {cats.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Tidak ada kategori vendor.</p>
          )}
        </div>
      )}
    </Drawer>
  );
}
