"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateVendor, useUpdateVendor } from "@/hooks/use-vendors";
import type { VendorCategoryItem } from "@/lib/queries/vendors";
import type { PaymentMethodInput } from "@/lib/validations/vendor";

type VendorWithPayments = VendorCategoryItem["vendors"][number] & { categoryName?: string };

interface VendorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  vendor?: VendorWithPayments | null;
  categories: VendorCategoryItem[];
}

export function VendorDrawer({ isOpen, onClose, vendor, categories }: VendorDrawerProps) {
  const createMut = useCreateVendor();
  const updateMut = useUpdateVendor();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInput[]>([]);
  const [saving, setSaving] = useState(false);

  const isEdit = !!vendor;
  const selectedCatName = categories.find((c) => c.id === categoryId)?.name;

  useEffect(() => {
    if (isOpen && vendor) {
      setName(vendor.name);
      setCategoryId(vendor.categoryId);
      setDescription(vendor.description ?? "");
      setPhone(vendor.phone ?? "");
      setAddress(vendor.address ?? "");
      setPaymentMethods(
        (vendor.paymentMethods ?? []).map((pm) => ({
          bankName: pm.bankName,
          bankAccountNumber: pm.bankAccountNumber,
          bankRecipient: pm.bankRecipient,
        }))
      );
    } else if (isOpen) {
      setName("");
      setCategoryId(categories[0]?.id ?? "");
      setDescription("");
      setPhone("");
      setAddress("");
      setPaymentMethods([]);
    }
  }, [isOpen, vendor, categories]);

  function updatePM(idx: number, field: keyof PaymentMethodInput, value: string) {
    setPaymentMethods((p) => p.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  async function handleSave() {
    if (!name.trim() || !categoryId) {
      toast.error("Nama vendor dan kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        categoryId,
        description: description.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        paymentMethods: paymentMethods.filter((pm) => pm.bankName && pm.bankAccountNumber && pm.bankRecipient),
      };
      const res = isEdit
        ? await updateMut.mutateAsync({ id: vendor!.id, data })
        : await createMut.mutateAsync(data);
      if (res.success) {
        toast.success(isEdit ? "Vendor updated" : "Vendor created");
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
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${isEdit ? "Edit" : "Tambah"} Vendor${selectedCatName ? ` - ${selectedCatName}` : ""}`}
      maxWidth="sm:max-w-sm"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Nama Vendor *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama vendor" className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Kategori Vendor *</Label>
            <SearchableSelect
              options={categories.map((cat) => ({ id: cat.id, name: cat.name }))}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Pilih kategori"
              searchPlaceholder="Cari kategori..."
              emptyText="Tidak ada kategori"
              className="text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi vendor..." className="min-h-[60px] text-sm resize-y" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">No. Telepon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contoh: 08123456789" className="h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Alamat</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat vendor..." className="min-h-[60px] text-sm resize-y" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Rekening Bank</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setPaymentMethods((p) => [...p, { bankName: "", bankAccountNumber: "", bankRecipient: "" }])} className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Tambah
              </Button>
            </div>

            {paymentMethods.length === 0 && (
              <p className="text-xs text-muted-foreground">Belum ada rekening bank</p>
            )}

            {paymentMethods.map((pm, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Rekening {idx + 1}</span>
                  <button className="p-1 hover:bg-muted rounded cursor-pointer" onClick={() => setPaymentMethods((p) => p.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
                <Input value={pm.bankName} onChange={(e) => updatePM(idx, "bankName", e.target.value)} placeholder="Nama Bank (BCA, Mandiri, dll)" className="h-8 text-xs" />
                <Input value={pm.bankAccountNumber} onChange={(e) => updatePM(idx, "bankAccountNumber", e.target.value)} placeholder="No. Rekening" className="h-8 text-xs" />
                <Input value={pm.bankRecipient} onChange={(e) => updatePM(idx, "bankRecipient", e.target.value)} placeholder="Nama Pemilik Rekening" className="h-8 text-xs" />
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t pt-4 mt-4">
          <Button onClick={handleSave} disabled={saving || !name.trim() || !categoryId} className="w-full bg-black text-white hover:bg-gray-800 cursor-pointer">
            {saving ? "Menyimpan..." : isEdit ? "Simpan Perubahan" : "Tambah Vendor"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
