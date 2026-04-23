"use client";

import * as React from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Save, Package } from "lucide-react";
import { toast } from "sonner";
import type { BookingDetail } from "@/lib/queries/bookings";
import { POCateringEditorV2 } from "./po-catering-editor";
import type { POCateringV2 } from "@/types/po-catering";
import { createDefaultPOV2 } from "@/types/po-catering";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetail;
  onUpdated?: () => void;
  isViewOnly?: boolean;
}

const DECORATION_KEYWORDS = ["dekorasi", "decoration", "decor", "dekor"];

export function DecorationSelectionDrawer({ isOpen, onClose, booking, onUpdated, isViewOnly }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [poData, setPOData] = React.useState<POCateringV2>(createDefaultPOV2());
  const skipReloadRef = React.useRef(false);

  const decorationItem = React.useMemo(() => {
    return booking.snapVendorItems.find((v) =>
      DECORATION_KEYWORDS.some((k) => v.vendorCategoryName.toLowerCase().includes(k)) && !v.isAddons
    );
  }, [booking.snapVendorItems]);

  const decorationVendorName = decorationItem?.vendorName ?? "Dekorasi";
  const draftKey = `po-decoration-draft:${booking.id}`;

  React.useEffect(() => {
    if (!isOpen || !decorationItem) return;
    if (skipReloadRef.current) { skipReloadRef.current = false; return; }

    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.version === 2) { setPOData(parsed); return; }
      }
    } catch {}

    const raw = decorationItem.paketData;
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 2) {
      const dbData = raw as unknown as POCateringV2;
      setPOData(dbData);
      try { localStorage.setItem(draftKey, JSON.stringify(dbData)); } catch {}
      return;
    }

    const defaultData = createDefaultPOV2();
    setPOData(defaultData);
    try { localStorage.setItem(draftKey, JSON.stringify(defaultData)); } catch {}
  }, [isOpen, decorationItem]);

  React.useEffect(() => {
    if (!isOpen) return;
    try { localStorage.setItem(draftKey, JSON.stringify(poData)); } catch {}
  }, [poData, isOpen, draftKey]);

  const handleSubmit = async () => {
    if (!decorationItem) { toast.error("Vendor dekorasi tidak ditemukan"); return; }
    setLoading(true);
    try {
      const { savePODecorationData } = await import("@/actions/decoration");
      const result = await savePODecorationData(decorationItem.id, poData);
      if (!result.success) toast.error(result.error);
      else {
        toast.success("PO Dekorasi berhasil disimpan");
        try { localStorage.removeItem(draftKey); } catch {}
        skipReloadRef.current = true;
        onUpdated?.();
      }
    } catch { toast.error("Gagal menyimpan"); }
    setLoading(false);
  };

  if (!decorationItem) {
    return (
      <Drawer isOpen={isOpen} onClose={onClose} title={`Dekorasi — ${booking.snapCustomer?.name ?? "-"}`}>
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <Package className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">Belum ada vendor dekorasi yang di-set.</p>
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
    <Drawer isOpen={isOpen} onClose={onClose} title={`Dekorasi — ${booking.snapCustomer?.name ?? "-"} • ${decorationVendorName}`} maxWidth="sm:max-w-full" headerActions={headerActions}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden p-4">
          <POCateringEditorV2 data={poData} onChange={setPOData} readOnly={isViewOnly} />
        </div>
      </div>
    </Drawer>
  );
}
