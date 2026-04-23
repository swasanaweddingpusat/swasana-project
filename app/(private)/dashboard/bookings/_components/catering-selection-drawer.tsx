"use client";

import * as React from "react";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Save, Package, Printer } from "lucide-react";
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

export function CateringSelectionDrawer({ isOpen, onClose, booking, onUpdated, isViewOnly }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [poData, setPOData] = React.useState<POCateringV2>(createDefaultPOV2());
  const skipReloadRef = React.useRef(false);
  const isLoadedRef = React.useRef(false);

  const cateringItem = React.useMemo(() => {
    return booking.snapVendorItems.find((v) => v.vendorCategoryName.toLowerCase().includes("catering") && !v.isAddons);
  }, [booking.snapVendorItems]);

  const cateringVendorName = cateringItem?.vendorName ?? "Catering";
  const draftKey = `po-catering-draft:${booking.id}`;

  // Reset loaded flag when drawer closes
  React.useEffect(() => {
    if (!isOpen) { isLoadedRef.current = false; }
  }, [isOpen]);

  // Load PO data — draft first, then DB, then default
  React.useEffect(() => {
    if (!isOpen || !cateringItem) return;
    if (skipReloadRef.current) { skipReloadRef.current = false; return; }

    // 1. Try localStorage draft
    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.version === 2) { setPOData(parsed); isLoadedRef.current = true; return; }
      }
    } catch {}

    // 2. Try DB data
    const raw = cateringItem.paketData;
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 2) {
      const dbData = raw as unknown as POCateringV2;
      setPOData(dbData);
      try { localStorage.setItem(draftKey, JSON.stringify(dbData)); } catch {}
      isLoadedRef.current = true;
      return;
    }

    // 3. Create default
    const defaultData = createDefaultPOV2();
    setPOData(defaultData);
    try { localStorage.setItem(draftKey, JSON.stringify(defaultData)); } catch {}
    isLoadedRef.current = true;
  }, [isOpen, cateringItem]);

  // Auto-save to localStorage — only after initial load, with small delay
  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (!isOpen || !isLoadedRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (!isLoadedRef.current) return;
      try { localStorage.setItem(draftKey, JSON.stringify(poData)); } catch {}
    }, 300);
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
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

  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrintPO = async () => {
    setIsPrinting(true);
    const t = toast.loading("Sedang membuat PDF...");
    try {
      const res = await fetch("/api/render-catering-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      toast.success("PDF siap!", { id: t });
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("Gagal membuat PDF", { id: t });
    } finally {
      setIsPrinting(false);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={handlePrintPO} disabled={isPrinting} className="h-8 px-3 text-xs cursor-pointer">
        <Printer className="h-3.5 w-3.5 mr-1" />{isPrinting ? "..." : "Cetak PO"}
      </Button>
      {!isViewOnly && (
        <Button size="sm" onClick={handleSubmit} disabled={loading} className="h-8 px-3 text-xs cursor-pointer">
          <Save className="h-3.5 w-3.5 mr-1" />{loading ? "Menyimpan..." : "Simpan"}
        </Button>
      )}
    </div>
  );

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Catering — ${booking.snapCustomer?.name ?? "-"} • ${cateringVendorName}`} maxWidth="sm:max-w-full" headerActions={headerActions}>
      <div className="flex flex-col h-full">
        <div className="p-4">
          <POCateringEditorV2 data={poData} onChange={setPOData} readOnly={isViewOnly} />
        </div>
      </div>
    </Drawer>
  );
}
