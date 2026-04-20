"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateVendorCategory, useUpdateVendorCategory } from "@/hooks/use-vendors";
import type { VendorCategoryItem } from "@/lib/queries/vendors";

interface VendorCategoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  category?: VendorCategoryItem | null;
}

export function VendorCategoryDrawer({ isOpen, onClose, category }: VendorCategoryDrawerProps) {
  const createMut = useCreateVendorCategory();
  const updateMut = useUpdateVendorCategory();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  const isEdit = !!category;

  useEffect(() => {
    if (isOpen && category) {
      setName(category.name);
      setDescription(category.description ?? "");
      setSortOrder(category.sortOrder);
    } else if (isOpen) {
      setName("");
      setDescription("");
      setSortOrder(0);
    }
  }, [isOpen, category]);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const data = { name: name.trim(), description: description.trim() || null, sortOrder };
      const res = isEdit
        ? await updateMut.mutateAsync({ id: category!.id, data })
        : await createMut.mutateAsync(data);

      if (res.success) {
        toast.success(isEdit ? "Category updated" : "Category created");
        onClose();
      } else {
        toast.error(res.error ?? "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Vendor Category" : "Add Vendor Category"}>
      <div className="flex flex-col justify-between h-full">
        <div className="space-y-4 px-1">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Nama Kategori *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Catering, Decoration" className="border-[#CCCCCC] bg-[#F9F9F9]" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Description (Optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi kategori" className="border-[#CCCCCC] bg-[#F9F9F9]" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Urutan</Label>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} min={0} className="border-[#CCCCCC] bg-[#F9F9F9]" />
            <p className="text-xs text-muted-foreground">Angka lebih kecil tampil lebih atas</p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t pt-4 mt-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 text-red-600 border-red-600 hover:bg-red-50 cursor-pointer" disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-black text-white hover:bg-gray-800 cursor-pointer" disabled={saving || !name.trim()}>
              {saving ? "Processing..." : isEdit ? "Update Category" : "Add Category"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
