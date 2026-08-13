"use client";

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AltArrowDown, CloseCircle } from "@solar-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { saveSnapComplimentaries } from "@/actions/snap-package-items";
import { firstError, complimentaryRowsSchema } from "@/lib/validations/booking-form";
import { createComplimentary } from "@/actions/complimentary";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { usePermissions } from "@/hooks/use-permissions";
import { ComplimentarySelect } from "@/app/(private)/booking/booking-weddings/_components/ComplimentarySelect";
import type { BookingDetail } from "@/lib/queries/bookings";

// --- Types -------------------------------------------------------------------

export interface EditComplimentaryTarget {
  bookingId: string;
  customerName: string;
}

interface ComplimentaryRow {
  uid: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description: string;
  qty: number;
}

/** Imperative handle exposed to parent when embedded in step 2 of edit-booking drawer. */
export interface ComplimentaryHandle {
  save: () => Promise<void>;
  isDirty: () => boolean;
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

// --- ComplimentaryBody -- inner component with forwarded ref -----------------
// State initialized once from bookingDetail via useState lazy initializer.
// The parent passes key={bookingId} to ensure a fresh remount per booking.

interface ComplimentaryBodyProps {
  bookingDetail: BookingDetail;
  target: EditComplimentaryTarget;
  onClose: () => void;
  /** When true, hides the sticky footer (save/cancel buttons). Used when embedded
   *  inside the edit-booking drawer — the parent step footer handles saving via the
   *  imperative handle. */
  hideActions?: boolean;
}

const ComplimentaryBody = forwardRef<ComplimentaryHandle, ComplimentaryBodyProps>(
  function ComplimentaryBody({ bookingDetail, target, onClose, hideActions }, ref) {
    const qc = useQueryClient();

    const [complimentaries, setComplimentaries] = useState<ComplimentaryRow[]>(() =>
      (bookingDetail.snapComplimentaries ?? []).map((c) => ({
        uid: c.id,
        complimentaryId: c.complimentaryId ?? null,
        name: c.name,
        price: Number(c.price) || 0,
        isShowPrice: Boolean(c.isShowPrice),
        description: c.description ?? "",
        qty: Number(c.qty) || 1,
      })),
    );

    // Capture initial value once for dirty-checking. Using null sentinel so we
    // initialize exactly once (React's useState lazy init already ran above).
    const initialJsonRef = useRef<string | null>(null);
    if (initialJsonRef.current === null) {
      initialJsonRef.current = JSON.stringify(complimentaries);
    }
    // Keep a current-value ref so the imperative handle always reads the latest state.
    const complimentariesRef = useRef(complimentaries);
    complimentariesRef.current = complimentaries;

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [mode, setMode] = useState<"none" | "create-new">("none");
    const [createNewComp, setCreateNewComp] = useState({ name: "", price: 0, description: "", isShowPrice: false });
    const [isCreatingComp, setIsCreatingComp] = useState(false);
    const [saving, setSaving] = useState(false);

    const { data: complimentaryData } = useComplimentaries({ activeOnly: true });
    const complimentaryOptions = complimentaryData?.items ?? [];
    const { can: canPermission, isAdmin: isPermAdmin } = usePermissions();
    const canCreateComplimentary = canPermission("complimentary", "create") || isPermAdmin;

    const toggleCollapse = useCallback((uid: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(uid)) { next.delete(uid); } else { next.add(uid); }
        return next;
      });
    }, []);

    const removeRow = useCallback((uid: string) => {
      setComplimentaries((prev) => prev.filter((x) => x.uid !== uid));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }, []);

    const handleCreateNew = useCallback(async () => {
      if (!createNewComp.name.trim() || isCreatingComp) return;
      setIsCreatingComp(true);
      try {
        const result = await createComplimentary({
          name: createNewComp.name.trim(),
          price: createNewComp.price,
          description: createNewComp.description.trim() || null,
          isShowPrice: createNewComp.isShowPrice,
          isActive: true,
        });
        if (result.success && result.item) {
          setComplimentaries((prev) => [
            ...prev,
            {
              uid: `new-${Date.now()}`,
              complimentaryId: result.item!.id,
              name: result.item!.name,
              price: result.item!.price,
              isShowPrice: result.item!.isShowPrice,
              description: result.item!.description ?? "",
              qty: 1,
            },
          ]);
          setMode("none");
          toast.success(`"${result.item.name}" berhasil ditambahkan`);
        } else {
          toast.error(result.error ?? "Gagal menambahkan complimentary");
        }
      } finally {
        setIsCreatingComp(false);
      }
    }, [createNewComp, isCreatingComp]);

    const handleSave = useCallback(async () => {
      const compErr = firstError(complimentaryRowsSchema, complimentaries);
      if (compErr) { toast.error(compErr); return; }
      setSaving(true);
      const res = await saveSnapComplimentaries({
        bookingId: target.bookingId,
        items: complimentaries.map((c, i) => ({
          complimentaryId: c.complimentaryId ?? null,
          name: c.name,
          price: c.price,
          isShowPrice: c.isShowPrice,
          description: c.description.trim() || null,
          qty: c.qty,
          sortOrder: i,
        })),
      });
      setSaving(false);
      if (!res.success) { toast.error(res.error ?? "Gagal menyimpan."); return; }
      toast.success("Complimentary berhasil disimpan.");
      await qc.invalidateQueries({ queryKey: ["booking-detail", target.bookingId] });
      onClose();
    }, [target.bookingId, complimentaries, qc, onClose]);

    // Expose save + isDirty to parent when embedded via ref.
    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty: () => JSON.stringify(complimentariesRef.current) !== initialJsonRef.current,
    }), [handleSave]);

    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 space-y-3">
          <p className="text-sm text-muted-foreground">
            Complimentary yang tampil di PO booking. Menyimpan tidak mempengaruhi approval maupun client agreement.
          </p>

          {/* Picker -- hidden when in create-new mode */}
          {mode !== "create-new" && (
            <ComplimentarySelect
              options={complimentaryOptions
                .filter((opt) => !complimentaries.some((c) => c.complimentaryId === opt.id))
                .map((opt) => ({
                  id: opt.id,
                  name: opt.name,
                  badge: `Rp${fmtRp(opt.price)}`,
                  description: opt.description ?? undefined,
                }))}
              value=""
              onChange={(cId) => {
                const opt = complimentaryOptions.find((c) => c.id === cId);
                if (opt) {
                  setComplimentaries((prev) => [
                    ...prev,
                    {
                      uid: `new-${Date.now()}`,
                      complimentaryId: opt.id,
                      name: opt.name,
                      price: opt.price,
                      isShowPrice: opt.isShowPrice,
                      description: "",
                      qty: 1,
                    },
                  ]);
                }
              }}
              onAddTrigger={canCreateComplimentary ? (text) => {
                setMode("create-new");
                setCreateNewComp({ name: text, price: 0, description: "", isShowPrice: false });
              } : undefined}
              placeholder="Pilih dari daftar complimentary..."
              searchPlaceholder="Cari complimentary..."
              emptyText="Tidak ada complimentary"
            />
          )}

          {/* Create-new master form */}
          {mode === "create-new" && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Tambah complimentary baru ke master</p>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMode("none")}>Batal</button>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Nama <span className="text-destructive">*</span></label>
                <Input
                  value={createNewComp.name}
                  onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nama complimentary..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                    placeholder="Harga (opsional)"
                    value={createNewComp.price ? fmtRp(createNewComp.price) : ""}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ""));
                      setCreateNewComp((p) => ({ ...p, price: n }));
                    }}
                  />
                </div>
                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                  <Switch
                    checked={createNewComp.isShowPrice}
                    onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))}
                  />
                  <span className="text-xs text-muted-foreground">Tampil harga</span>
                </label>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                <Textarea
                  value={createNewComp.description}
                  onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Keterangan complimentary (opsional)..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
              <Button
                type="button"
                className="w-full rounded-xl"
                disabled={!createNewComp.name.trim() || isCreatingComp}
                onClick={handleCreateNew}
              >
                {isCreatingComp ? "Menyimpan..." : "Simpan & Tambahkan"}
              </Button>
            </div>
          )}

          {/* Selected rows */}
          {complimentaries.map((c) => {
            const isOpen = !collapsed.has(c.uid);
            return (
              <Collapsible
                key={c.uid}
                open={isOpen}
                onOpenChange={() => toggleCollapse(c.uid)}
                className="rounded-xl border border-border bg-muted/30 overflow-hidden"
              >
                <div className="flex items-center gap-1 px-3 py-2.5">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                    <AltArrowDown
                      weight="BoldDuotone"
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      {!isOpen && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {c.isShowPrice && c.price ? `Rp${fmtRp(c.price)}` : "Harga tidak ditampilkan"}
                        </p>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => { e.stopPropagation(); removeRow(c.uid); }}
                    aria-label="Hapus complimentary"
                  >
                    <CloseCircle weight="BoldDuotone" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Nama <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={c.name}
                        onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.uid === c.uid ? { ...x, name: e.target.value } : x))}
                        placeholder="Nama complimentary..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                          placeholder="Harga"
                          value={c.price ? fmtRp(c.price) : ""}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            setComplimentaries((prev) => prev.map((x) => x.uid === c.uid ? { ...x, price: n } : x));
                          }}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                        <Switch
                          checked={c.isShowPrice}
                          onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.uid === c.uid ? { ...x, isShowPrice: v } : x))}
                        />
                        <span className="text-xs text-muted-foreground">Tampil harga</span>
                      </label>
                    </div>
                    <Textarea
                      value={c.description}
                      onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.uid === c.uid ? { ...x, description: e.target.value } : x))}
                      placeholder="Keterangan complimentary..."
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {complimentaries.length === 0 && mode === "none" && (
            <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
              Belum ada complimentary.
            </p>
          )}
        </div>

        {/* Sticky footer: hidden when embedded (parent's step footer handles saving). */}
        {!hideActions && (
          <div className="sticky bottom-0 mt-6 border-t border-border bg-background pt-4 pb-1">
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                Batal
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
                {saving ? "Menyimpan..." : "Simpan Complimentary"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

// --- EditComplimentaryContent -- exported embeddable wrapper -----------------
// Fetches booking-detail independently and renders ComplimentaryBody with a
// forwarded ref. Used by edit-booking-drawer step 2 to embed complimentary
// editing without a Drawer shell of its own.

export const EditComplimentaryContent = forwardRef<
  ComplimentaryHandle,
  { bookingId: string; onClose: () => void; hideActions?: boolean }
>(function EditComplimentaryContent({ bookingId, onClose, hideActions }, ref) {
  const { data: bookingDetail, isLoading } = useQuery<BookingDetail>({
    queryKey: ["booking-detail", bookingId],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/${bookingId}`);
      if (!res.ok) throw new Error("Failed to fetch booking detail");
      return res.json() as Promise<BookingDetail>;
    },
    enabled: !!bookingId,
    staleTime: 0,
  });

  if (isLoading || !bookingDetail) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <ComplimentaryBody
      key={bookingId}
      ref={ref}
      bookingDetail={bookingDetail}
      target={{ bookingId, customerName: "" }}
      onClose={onClose}
      hideActions={hideActions}
    />
  );
});

