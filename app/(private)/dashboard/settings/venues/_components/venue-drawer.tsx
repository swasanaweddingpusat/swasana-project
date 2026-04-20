"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { createVenue, updateVenue } from "@/actions/venue";
import type { VenueQueryItem, BrandsQueryResult } from "@/lib/queries/venues";

interface VenueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingVenue?: VenueQueryItem | null;
  brands: BrandsQueryResult;
  onSaved: (venue: VenueQueryItem, isEdit: boolean) => void;
}

interface FormData {
  name: string;
  code: string;
  brandId: string;
  description: string;
  address: string;
  capacity: string;
}

export function VenueDrawer({ isOpen, onClose, editingVenue, brands, onSaved }: VenueDrawerProps) {
  const isEdit = !!editingVenue;
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormData>({ name: "", code: "", brandId: "", description: "", address: "", capacity: "" });

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setForm(editingVenue ? {
        name: editingVenue.name,
        code: editingVenue.code,
        brandId: editingVenue.brandId ?? "",
        description: editingVenue.description ?? "",
        address: editingVenue.address ?? "",
        capacity: editingVenue.capacity?.toString() ?? "",
      } : { name: "", code: "", brandId: "", description: "", address: "", capacity: "" });
    }
  }, [isOpen, editingVenue]);

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nama venue wajib diisi";
    if (!form.code.trim()) e.code = "Kode venue wajib diisi";
    if (form.capacity && isNaN(Number(form.capacity))) e.capacity = "Kapasitas harus berupa angka";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);

    const data = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      brandId: form.brandId || null,
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      capacity: form.capacity ? parseInt(form.capacity) : null,
    };

    const result = isEdit
      ? await updateVenue({ id: editingVenue!.id, ...data })
      : await createVenue(data);

    setSaving(false);

    if (!result.success) { toast.error(result.error); return; }
    toast.success(isEdit ? "Venue diperbarui." : "Venue dibuat.");
    onSaved(result.venue as VenueQueryItem, isEdit);
    onClose();
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Venue" : "Tambah Venue"}>
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4 px-1">
          {/* Brand */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Brand</Label>
            <SearchableSelect
              options={brands.map((b) => ({ id: b.id, name: b.name }))}
              value={form.brandId}
              onChange={(v) => set("brandId", v)}
              placeholder="Pilih brand (opsional)"
              searchPlaceholder="Cari brand..."
              emptyText="Tidak ada brand"
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Nama Venue *</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Brin Gatot Subroto"
              className={cn("border-[#CCCCCC] bg-[#F9F9F9]", errors.name && "border-red-500")}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Code */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Kode Venue *</Label>
            <Input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="e.g. BRINGATSU"
              className={cn("border-[#CCCCCC] bg-[#F9F9F9] uppercase", errors.code && "border-red-500")}
            />
            {errors.code && <p className="text-xs text-red-500">{errors.code}</p>}
          </div>

          {/* Capacity */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Kapasitas (Pax)</Label>
            <Input
              type="number"
              value={form.capacity}
              onChange={(e) => set("capacity", e.target.value)}
              placeholder="e.g. 500"
              className={cn("border-[#CCCCCC] bg-[#F9F9F9]", errors.capacity && "border-red-500")}
            />
            {errors.capacity && <p className="text-xs text-red-500">{errors.capacity}</p>}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Alamat</Label>
            <Textarea
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. Jl. Raya No. 1, Jakarta"
              rows={3}
              className="border-[#CCCCCC] bg-[#F9F9F9]"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Deskripsi / Fasilitas</Label>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Free parking, Free wifi, etc."
              rows={3}
              className="border-[#CCCCCC] bg-[#F9F9F9]"
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-white pt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 cursor-pointer text-red-600 border-red-600 hover:bg-red-50" disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer" disabled={saving}>
              {saving ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Venue"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
