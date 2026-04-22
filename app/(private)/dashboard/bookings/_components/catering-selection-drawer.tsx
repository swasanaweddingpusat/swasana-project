"use client";

import * as React from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Save, Package, Printer } from "lucide-react";
import { toast } from "sonner";
import type { BookingDetail } from "@/lib/queries/bookings";
import { POCateringEditor } from "./po-catering-editor";
import type { POCateringData } from "@/types/po-catering";
import { createDefaultPOCatering } from "@/types/po-catering";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetail;
  onUpdated?: () => void;
  isViewOnly?: boolean;
}

export function CateringSelectionDrawer({ isOpen, onClose, booking, onUpdated, isViewOnly }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [poData, setPOData] = React.useState<POCateringData>(createDefaultPOCatering());
  const skipReloadRef = React.useRef(false);

  const cateringItem = React.useMemo(() => {
    return booking.snapVendorItems.find((v) => v.vendorCategoryName.toLowerCase().includes("catering") && !v.isAddons);
  }, [booking.snapVendorItems]);

  const cateringVendorName = cateringItem?.vendorName ?? "Catering";
  const draftKey = `po-catering-draft:${booking.id}`;

  // Load PO data — draft first, then DB, then default
  React.useEffect(() => {
    if (!isOpen || !cateringItem) return;
    if (skipReloadRef.current) { skipReloadRef.current = false; return; }

    // Try draft from localStorage
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) { setPOData(JSON.parse(draft)); return; }
    } catch {}

    // Fall back to DB data
    const raw = cateringItem.paketData;
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 1) {
      setPOData(raw as unknown as POCateringData);
    } else {
      setPOData(createDefaultPOCatering());
    }
  }, [isOpen, cateringItem]);

  // Auto-save to localStorage on every change
  React.useEffect(() => {
    if (!isOpen) return;
    try { localStorage.setItem(draftKey, JSON.stringify(poData)); } catch {}
  }, [poData, isOpen, draftKey]);

  const handleSubmit = async () => {
    if (!cateringItem) { toast.error("Vendor catering tidak ditemukan"); return; }
    setLoading(true);
    try {
      const { savePOCateringData } = await import("@/actions/catering");
      const result = await savePOCateringData(cateringItem.id, poData);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("PO Catering berhasil disimpan");
        try { localStorage.removeItem(draftKey); } catch {}
        skipReloadRef.current = true;
        onUpdated?.();
      }
    } catch { toast.error("Gagal menyimpan"); }
    setLoading(false);
  };

  if (!cateringItem) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={`Catering — ${booking.snapCustomer?.name ?? "-"}`}>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <Package className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Belum ada vendor catering yang di-set.</p>
          <p className="text-xs text-gray-400 mt-1">Set vendor bawaan terlebih dahulu.</p>
        </div>
      </Drawer>
    );
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      {!isViewOnly && (
        <Button size="sm" onClick={handleSubmit} disabled={loading} className="h-8 px-3 text-xs cursor-pointer">
          <Save className="h-3.5 w-3.5 mr-1" />{loading ? "Menyimpan..." : "Simpan"}
        </Button>
      )}
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Catering — ${booking.snapCustomer?.name ?? "-"} • ${cateringVendorName}`} maxWidth="sm:max-w-full" headerActions={headerActions}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden p-4">
          <POCateringEditor data={poData} onChange={setPOData} readOnly={isViewOnly} />
        </div>
      </div>
    </Drawer>
  );
}
