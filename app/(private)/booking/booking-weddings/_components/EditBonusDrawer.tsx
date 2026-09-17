"use client";

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AltArrowDown, CloseCircle } from "@solar-icons/react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { saveSnapBookingBonuses } from "@/actions/snap-package-items";
import { firstError, bonusRowsSchema } from "@/lib/validations/booking-form";
import { createBonus } from "@/actions/bonus";
import { useBonuses } from "@/hooks/use-bonuses";
import { usePermissions } from "@/hooks/use-permissions";
import { BonusSelect } from "@/components/shared/BonusSelect";
import type { BookingDetail } from "@/lib/queries/bookings";
import type { SnapBookingBonusItemInput } from "@/lib/validations/snap-package-items";

// --- Types -------------------------------------------------------------------

export interface EditBonusTarget {
  bookingId: string;
  customerName: string;
}

interface BonusRow {
  uid: string;
  bonusId: string | null;
  name: string;
  price: number;
  description: string;
  qty: number;
}

/** Imperative handle exposed to parent when embedded in step 3 of edit-booking drawer. */
export interface BonusHandle {
  save: () => Promise<void>;
  isDirty: () => boolean;
  /** Validate current rows without saving. Returns an error message, or null if valid. */
  validate: () => string | null;
  /** Current rows mapped to the save-payload shape, without saving. */
  getItems: () => SnapBookingBonusItemInput[];
}

function fmtRp(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

// --- BonusBody -- inner component with forwarded ref -------------------------
// State initialized once from bookingDetail via useState lazy initializer.
// The parent passes key={bookingId} to ensure a fresh remount per booking.

interface BonusBodyProps {
  bookingDetail: BookingDetail;
  target: EditBonusTarget;
  onClose: () => void;
  /** When true, hides the sticky footer (save/cancel buttons). Used when embedded
   *  inside the edit-booking drawer — the parent step footer handles saving via the
   *  imperative handle. */
  hideActions?: boolean;
}

const BonusBody = forwardRef<BonusHandle, BonusBodyProps>(
  function BonusBody({ bookingDetail, target, onClose, hideActions }, ref) {
    const qc = useQueryClient();

    const [bonuses, setBonuses] = useState<BonusRow[]>(() =>
      (bookingDetail.snapBookingBonuses ?? []).map((b) => ({
        uid: b.id,
        bonusId: b.bonusId ?? null,
        name: b.name,
        price: Number(b.price) || 0,
        description: b.description ?? "",
        qty: Number(b.qty) || 1,
      })),
    );

    // Capture initial value once for dirty-checking. Using null sentinel so we
    // initialize exactly once (React's useState lazy init already ran above).
    const initialJsonRef = useRef<string | null>(null);
    if (initialJsonRef.current === null) {
      initialJsonRef.current = JSON.stringify(bonuses);
    }
    // Keep a current-value ref so the imperative handle always reads the latest state.
    const bonusesRef = useRef(bonuses);
    bonusesRef.current = bonuses;

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const [mode, setMode] = useState<"none" | "create-new">("none");
    const [createNewBonus, setCreateNewBonus] = useState({ name: "", price: 0, description: "" });
    const [isCreatingBonus, setIsCreatingBonus] = useState(false);
    const [saving, setSaving] = useState(false);

    const { data: bonusData } = useBonuses({ activeOnly: true });
    const bonusOptions = bonusData?.data ?? [];
    const { can: canPermission, isAdmin: isPermAdmin } = usePermissions();
    const canCreateBonus = canPermission("bonus", "create") || isPermAdmin;

    const toggleCollapse = useCallback((uid: string) => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(uid)) { next.delete(uid); } else { next.add(uid); }
        return next;
      });
    }, []);

    const removeRow = useCallback((uid: string) => {
      setBonuses((prev) => prev.filter((x) => x.uid !== uid));
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }, []);

    const handleCreateNew = useCallback(async () => {
      if (!createNewBonus.name.trim() || createNewBonus.price <= 0 || isCreatingBonus) return;
      setIsCreatingBonus(true);
      try {
        const result = await createBonus({
          name: createNewBonus.name.trim(),
          price: createNewBonus.price,
          description: createNewBonus.description.trim() || null,
          isActive: true,
        });
        if (result.success) {
          setBonuses((prev) => [
            ...prev,
            {
              uid: `new-${Date.now()}`,
              bonusId: result.data.id,
              name: result.data.name,
              price: result.data.price,
              description: result.data.description ?? "",
              qty: 1,
            },
          ]);
          setMode("none");
          toast.success(`"${result.data.name}" berhasil ditambahkan`);
        } else {
          toast.error(result.error ?? "Gagal menambahkan bonus");
        }
      } finally {
        setIsCreatingBonus(false);
      }
    }, [createNewBonus, isCreatingBonus]);

    const handleSave = useCallback(async () => {
      const bonusErr = firstError(bonusRowsSchema, bonuses);
      if (bonusErr) { toast.error(bonusErr); return; }
      setSaving(true);
      const res = await saveSnapBookingBonuses({
        bookingId: target.bookingId,
        items: bonuses.map((b, i) => ({
          bonusId: b.bonusId ?? null,
          name: b.name,
          price: b.price,
          description: b.description.trim() || null,
          qty: b.qty,
          sortOrder: i,
        })),
      });
      setSaving(false);
      if (!res.success) { toast.error(res.error ?? "Gagal menyimpan."); return; }
      toast.success("Bonus berhasil disimpan.");
      await qc.invalidateQueries({ queryKey: ["booking-detail", target.bookingId] });
      onClose();
    }, [target.bookingId, bonuses, qc, onClose]);

    const getItems = useCallback((): SnapBookingBonusItemInput[] =>
      bonusesRef.current.map((b, i) => ({
        bonusId: b.bonusId ?? null,
        name: b.name,
        price: b.price,
        description: b.description.trim() || null,
        qty: b.qty,
        sortOrder: i,
      })), []);

    // Expose save + isDirty to parent when embedded via ref.
    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty: () => JSON.stringify(bonusesRef.current) !== initialJsonRef.current,
      validate: () => firstError(bonusRowsSchema, bonusesRef.current),
      getItems,
    }), [handleSave, getItems]);

    return (
      <div className="flex flex-col min-h-full">
        <div className="flex-1 space-y-3">
          {/* Picker -- hidden when in create-new mode */}
          {mode !== "create-new" && (
            <BonusSelect
              options={bonusOptions
                .filter((opt) => !bonuses.some((b) => b.bonusId === opt.id))
                .map((opt) => ({
                  id: opt.id,
                  name: opt.name,
                  badge: `Rp${fmtRp(opt.price)}`,
                  description: opt.description ?? undefined,
                }))}
              value=""
              onChange={(bId) => {
                const opt = bonusOptions.find((b) => b.id === bId);
                if (opt) {
                  setBonuses((prev) => [
                    ...prev,
                    {
                      uid: `new-${Date.now()}`,
                      bonusId: opt.id,
                      name: opt.name,
                      price: opt.price,
                      description: "",
                      qty: 1,
                    },
                  ]);
                }
              }}
              onAddTrigger={canCreateBonus ? (text) => {
                setMode("create-new");
                setCreateNewBonus({ name: text, price: 0, description: "" });
              } : undefined}
              placeholder="Pilih dari daftar bonus..."
              searchPlaceholder="Cari bonus..."
              emptyText="Tidak ada bonus"
            />
          )}

          {/* Create-new master form */}
          {mode === "create-new" && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Tambah bonus baru ke master</p>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMode("none")}>Batal</button>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Nama <span className="text-destructive">*</span></label>
                <Input
                  value={createNewBonus.name}
                  onChange={(e) => setCreateNewBonus((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nama bonus..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Harga <span className="text-destructive">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                    placeholder="Harga (wajib diisi)"
                    value={createNewBonus.price ? fmtRp(createNewBonus.price) : ""}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/\D/g, ""));
                      setCreateNewBonus((p) => ({ ...p, price: n }));
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                <Textarea
                  value={createNewBonus.description}
                  onChange={(e) => setCreateNewBonus((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Keterangan bonus (opsional)..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
              <Button
                type="button"
                className="w-full rounded-xl"
                disabled={!createNewBonus.name.trim() || createNewBonus.price <= 0 || isCreatingBonus}
                onClick={handleCreateNew}
              >
                {isCreatingBonus ? "Menyimpan..." : "Simpan & Tambahkan"}
              </Button>
            </div>
          )}

          {/* Selected rows */}
          {bonuses.map((b) => {
            const isOpen = !collapsed.has(b.uid);
            return (
              <Collapsible
                key={b.uid}
                open={isOpen}
                onOpenChange={() => toggleCollapse(b.uid)}
                className="rounded-xl border border-border bg-muted/30 overflow-hidden"
              >
                <div className="flex items-center gap-1 px-3 py-2.5">
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                    <AltArrowDown
                      weight="BoldDuotone"
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                      {!isOpen && (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {b.price ? `Rp${fmtRp(b.price)}` : "Harga belum diisi"}
                        </p>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <button
                    type="button"
                    className="shrink-0 p-1 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={(e) => { e.stopPropagation(); removeRow(b.uid); }}
                    aria-label="Hapus bonus"
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
                        value={b.name}
                        onChange={(e) => setBonuses((prev) => prev.map((x) => x.uid === b.uid ? { ...x, name: e.target.value } : x))}
                        placeholder="Nama bonus..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Harga <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Rp</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded-md bg-background"
                          placeholder="Harga"
                          value={b.price ? fmtRp(b.price) : ""}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            setBonuses((prev) => prev.map((x) => x.uid === b.uid ? { ...x, price: n } : x));
                          }}
                        />
                      </div>
                    </div>
                    <Textarea
                      value={b.description}
                      onChange={(e) => setBonuses((prev) => prev.map((x) => x.uid === b.uid ? { ...x, description: e.target.value } : x))}
                      placeholder="Keterangan bonus..."
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {bonuses.length === 0 && mode === "none" && (
            <p className="text-sm text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
              Belum ada bonus.
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
                {saving ? "Menyimpan..." : "Simpan Bonus"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);

// --- EditBonusContent -- exported embeddable wrapper --------------------------
// Fetches booking-detail independently and renders BonusBody with a forwarded
// ref. Used by edit-booking-drawer step 3 to embed bonus editing without a
// Drawer shell of its own.

export const EditBonusContent = forwardRef<
  BonusHandle,
  { bookingId: string; onClose: () => void; hideActions?: boolean }
>(function EditBonusContent({ bookingId, onClose, hideActions }, ref) {
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
    <BonusBody
      key={bookingId}
      ref={ref}
      bookingDetail={bookingDetail}
      target={{ bookingId, customerName: "" }}
      onClose={onClose}
      hideActions={hideActions}
    />
  );
});
