"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import { Save, Package, Printer } from "lucide-react";
import { toast } from "sonner";
import type { BookingDetail } from "@/lib/queries/bookings";
import { POCateringEditorV2 } from "./po-catering-editor";
import type { POCateringV2, PORow } from "@/types/po-catering";
import { createDefaultPOV2 } from "@/types/po-catering";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetail;
  onUpdated?: () => void;
  isViewOnly?: boolean;
}

const DECORATION_KEYWORDS = ["dekorasi", "decoration", "decor", "dekor"];

interface EligibleBooking { id: string; snapVendorItemId: string; label: string }

export function DecorationSelectionDrawer({ isOpen, onClose, booking, onUpdated, isViewOnly }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [poData, setPOData] = React.useState<POCateringV2>(createDefaultPOV2());
  const skipReloadRef = React.useRef(false);
  const isLoadedRef = React.useRef(false);

  const { data: paymentMethods = [] } = useQuery<{ id: string; bankName: string; bankAccountNumber: string; bankRecipient: string }[]>({
    queryKey: ["payment-methods"],
    queryFn: () => fetch("/api/payment-methods").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  const decorationItem = React.useMemo(() => {
    return booking.snapVendorItems.find((v) =>
      DECORATION_KEYWORDS.some((k) => v.vendorCategoryName.toLowerCase().includes(k)) && !v.isAddons
    );
  }, [booking.snapVendorItems]);

  const { data: eligibleBookings = [] } = useQuery<EligibleBooking[]>({
    queryKey: ["eligible-allocation", decorationItem?.vendorId, booking.id],
    queryFn: () => fetch(`/api/bookings/eligible-for-allocation?vendorId=${decorationItem!.vendorId}&excludeBookingId=${booking.id}`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen && !!decorationItem,
  });

  const decorationVendorName = decorationItem?.vendorName ?? "Dekorasi";
  const draftKey = `po-decoration-draft:${booking.id}`;

  React.useEffect(() => {
    if (!isOpen) { isLoadedRef.current = false; }
  }, [isOpen]);

  const injectIncomingRows = React.useCallback((base: POCateringV2): POCateringV2 => {
    if (!decorationItem) return base;
    const incomingSettlements = (booking.bookingRefunds ?? []).filter(
      (s) => s.type === "allocation" && s.targetBookingId === booking.id
    );
    if (incomingSettlements.length === 0) return base;
    const withoutIncoming = base.rows.filter((r) => !r.isIncoming);
    const incomingRows: PORow[] = incomingSettlements.map((s) => ({
      id: s.id,
      type: "settlement" as const,
      settlementType: "allocation" as const,
      isIncoming: true,
      grandTotal: Number(s.amount),
      description: s.notes ?? "Alokasi masuk",
      settlementSourceLabel: eligibleBookings.find((eb) => eb.id === s.bookingId)?.label ?? "Booking lain",
    }));
    return { ...base, rows: [...withoutIncoming, ...incomingRows] };
  }, [booking.bookingRefunds, booking.id, decorationItem, eligibleBookings]);

  React.useEffect(() => {
    if (!isOpen || !decorationItem) return;
    if (skipReloadRef.current) { skipReloadRef.current = false; return; }

    let base: POCateringV2;

    try {
      const draft = localStorage.getItem(draftKey);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed?.version === 2) { base = parsed; setPOData(injectIncomingRows(base)); isLoadedRef.current = true; return; }
      }
    } catch {}

    const raw = decorationItem.paketData;
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 2) {
      base = raw as unknown as POCateringV2;
      const injected = injectIncomingRows(base);
      setPOData(injected);
      try { localStorage.setItem(draftKey, JSON.stringify(injected)); } catch {}
      isLoadedRef.current = true;
      return;
    }

    base = createDefaultPOV2();
    const injected = injectIncomingRows(base);
    setPOData(injected);
    try { localStorage.setItem(draftKey, JSON.stringify(injected)); } catch {}
    isLoadedRef.current = true;
  }, [isOpen, decorationItem, injectIncomingRows]);

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

  const handlePrintPO = async () => {
    setIsPrinting(true);
    const t = toast.loading("Sedang membuat PDF...");
    try {
      const res = await fetch("/api/render-decoration-po", {
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
    <Drawer isOpen={isOpen} onClose={onClose} title={`Dekorasi — ${booking.snapCustomer?.name ?? "-"} • ${decorationVendorName}`} maxWidth="sm:max-w-full" headerActions={headerActions}>
      <div className="flex flex-col h-full">
        <div className="p-4">
          <POCateringEditorV2
            data={poData}
            onChange={setPOData}
            readOnly={isViewOnly}
            paymentMethods={paymentMethods}
            eligibleBookings={eligibleBookings}
          />
        </div>
      </div>
    </Drawer>
  );
}
