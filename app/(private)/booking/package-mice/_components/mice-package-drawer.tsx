"use client";

import { useState, useEffect } from "react";
import { Drawer } from "@/components/shared/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SimpleEditor } from "@/components/shared/SimpleEditor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { BankAccountSelect } from "@/components/shared/bank-account-select";
import { ComplimentarySelect } from "@/components/shared/ComplimentarySelect";
import { BonusSelect } from "@/components/shared/BonusSelect";
import { TermConditionEditor } from "@/components/shared/TermConditionEditor";
import {
  Box,
  ClipboardList,
  PenNewSquare,
  AddCircle,
  TrashBinTrash,
  AlignVerticalSpacing,
  TagPrice,
  Card2,
  Gift,
  MedalStar,
  AltArrowDown,
  SafeSquare,
} from "@solar-icons/react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useVenues } from "@/hooks/use-venues";
import { SignaturePad } from "@/components/shared/signature-pad";
import {
  useCreatePackage,
  useUpdatePackage,
  useSaveMiceItems,
  useSaveMicePrices,
  useSaveTaxDeposits,
  useSavePackageComplimentaries,
  useSavePackageBonuses,
} from "@/hooks/use-packages";
import { useComplimentaries } from "@/hooks/use-complimentaries";
import { useBonuses } from "@/hooks/use-bonuses";
import { usePermissions } from "@/hooks/use-permissions";
import { createComplimentary } from "@/actions/complimentary";
import { createBonus } from "@/actions/bonus";
import type { PackageQueryItem } from "@/lib/queries/packages";

// MICE package is always gated on the "package-mice" permission module.
const PERM = "package-mice";

// ─── Steps (MICE = 6 steps: Detail, Item, Harga, Payment, Complimentary & Bonus, Tanda Tangan) ──

const stepperSteps = [
  { id: 1, title: "Detail Paket", subtitle: "Informasi dasar paket", icon: Box },
  { id: 2, title: "Item Paket", subtitle: "Daftar item paket", icon: ClipboardList },
  { id: 3, title: "Harga", subtitle: "Rincian harga paket", icon: TagPrice },
  { id: 4, title: "Payment", subtitle: "Rekening & term & condition", icon: Card2 },
  { id: 5, title: "Complimentary & Bonus", subtitle: "Bonus & komplimen paket", icon: Gift },
  { id: 6, title: "Tanda Tangan", subtitle: "Konfirmasi & tanda tangan", icon: PenNewSquare },
];

interface MiceItemState {
  id: string;
  itemName: string;
  itemDescription: string;
}

// Local lowercase union — mapped to the uppercase DB enum ("QTY"/"NOMINAL") on submit.
type MicePriceTypeLocal = "qty" | "nominal";

interface MicePriceState {
  id: string;
  name: string;
  priceType: MicePriceTypeLocal;
  qty: string;
  price: string;
  total: string;
}

// Step 2 "Tax & Deposit" sub-collection — mirrors PackageMiceTaxDeposit (name + nominal).
interface TaxDepositState {
  id: string;
  name: string;
  nominal: string;
}

// Mirrors ComplimentaryRow/BonusRow from quotation-drawer.tsx, adapted for the
// PackageComplimentary/PackageBonus join tables (see prisma/schema.prisma).
interface ComplimentaryRow {
  id: string;
  complimentaryId: string | null;
  name: string;
  price: number;
  isShowPrice: boolean;
  description: string;
  qty: number;
}

interface BonusRow {
  id: string;
  bonusId: string | null;
  name: string;
  price: number;
  description: string;
  qty: number;
}

interface MicePackageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editingPackage?: PackageQueryItem | null;
}

// ─── Numeric/currency input helpers (same pattern as quotation-drawer.tsx) ─────

function parseNumericInput(raw: string): number {
  return parseInt(raw.replace(/\D/g, ""), 10) || 0;
}

function formatNumericDisplay(raw: string | number): string {
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}

function formatRupiah(amount: number): string {
  if (amount === 0) return "—";
  return amount.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const TAB_TRIGGER_CLASS = cn(
  "h-auto flex-none items-center gap-1.5 rounded-none border-0 border-b border-b-transparent -mb-px bg-transparent px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-none transition-colors after:hidden hover:border-b-border hover:text-foreground data-active:border-b-primary data-active:bg-transparent data-active:text-foreground data-active:shadow-none",
);

// ─── Sortable accordion row (Item Paket / Harga) ────────────────────────────────
// Header: drag handle + expand/collapse chevron + live title + delete. Body: collapsible.

function SortableAccordionRow({
  id,
  title,
  placeholder,
  isOpen,
  onToggleOpen,
  onRemove,
  children,
}: {
  id: string;
  title: string;
  placeholder: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-border bg-card shadow-sm overflow-hidden",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <div className={cn("flex items-center gap-1 px-3 py-2.5")}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn("p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none")}
          tabIndex={-1}
          aria-label="Urutkan"
        >
          <AlignVerticalSpacing weight="BoldDuotone" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          className={cn("flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left")}
        >
          <AltArrowDown
            weight="BoldDuotone"
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
          <span className={cn("text-sm font-semibold text-foreground truncate")}>
            {title.trim() || placeholder}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Hapus"
          className={cn("shrink-0 h-8 w-8 text-destructive hover:bg-destructive/10")}
        >
          <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
        </Button>
      </div>

      {isOpen && (
        <div className={cn("px-3 pb-3 pt-1 space-y-3 border-t border-border/60")}>{children}</div>
      )}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function MicePackageDrawer({ isOpen, onClose, editingPackage }: MicePackageDrawerProps) {
  const { data: venues = [] } = useVenues();
  const createPkg = useCreatePackage();
  const updatePkg = useUpdatePackage();
  const saveMiceItemsMut = useSaveMiceItems();
  const saveMicePricesMut = useSaveMicePrices();
  const saveTaxDepositsMut = useSaveTaxDeposits();
  const saveComplimentariesMut = useSavePackageComplimentaries();
  const saveBonusesMut = useSavePackageBonuses();
  const { can } = usePermissions();
  const canEditTc = can(PERM, "term-&-condition");

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — details
  const [packageName, setPackageName] = useState("");
  const [available, setAvailable] = useState(true);
  const [venueId, setVenueId] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 2 — items
  const [items, setItems] = useState<MiceItemState[]>([]);
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

  function toggleItemCollapse(id: string) {
    setCollapsedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Step 2 — tax & deposit (optional sub-collection, no min-count validation)
  const [taxDeposits, setTaxDeposits] = useState<TaxDepositState[]>([]);
  const [collapsedTaxDeposits, setCollapsedTaxDeposits] = useState<Set<string>>(new Set());

  function toggleTaxDepositCollapse(id: string) {
    setCollapsedTaxDeposits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Step 3 — prices ("Harga")
  const [prices, setPrices] = useState<MicePriceState[]>([]);
  const [collapsedPrices, setCollapsedPrices] = useState<Set<string>>(new Set());

  function togglePriceCollapse(id: string) {
    setCollapsedPrices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Step 4 — payment (bank account + gated security deposit / T&C / cancellation policy)
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [securityDeposit, setSecurityDeposit] = useState("");
  const [termAndCondition, setTermAndCondition] = useState("");
  const [cancellationRefundPolicy, setCancellationRefundPolicy] = useState("");

  // Step 5 — complimentary & bonus
  const [complimentaries, setComplimentaries] = useState<ComplimentaryRow[]>([]);
  const [complimentaryMode, setComplimentaryMode] = useState<"none" | "create-new">("none");
  const [collapsedComplimentaries, setCollapsedComplimentaries] = useState<Set<string>>(new Set());
  const [createNewComp, setCreateNewComp] = useState({ name: "", price: 0, description: "", isShowPrice: false });
  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const { data: complimentaryResult } = useComplimentaries({ activeOnly: true, pageSize: 100 });
  const complimentaryOptions = complimentaryResult?.items ?? [];
  const canCreateComplimentary = can("complimentary", "create");

  function toggleComplimentaryCollapse(id: string) {
    setCollapsedComplimentaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [bonusMode, setBonusMode] = useState<"none" | "create-new">("none");
  const [collapsedBonuses, setCollapsedBonuses] = useState<Set<string>>(new Set());
  const [createNewBonus, setCreateNewBonus] = useState({ name: "", price: 0, description: "" });
  const [isCreatingBonus, setIsCreatingBonus] = useState(false);
  const { data: bonusResult } = useBonuses({ activeOnly: true, pageSize: 100 });
  const bonusOptions = bonusResult?.data ?? [];
  const canCreateBonus = can("bonus", "create");

  function toggleBonusCollapse(id: string) {
    setCollapsedBonuses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Step 6 — signature
  const [signature, setSignature] = useState<string | null>(null);

  const isEdit = !!editingPackage;

  function resetForm() {
    setPackageName("");
    setAvailable(true);
    setVenueId("");
    setNotes("");
    setItems([]);
    setCollapsedItems(new Set());
    setTaxDeposits([]);
    setCollapsedTaxDeposits(new Set());
    setPrices([]);
    setCollapsedPrices(new Set());
    setPaymentMethodId("");
    setSecurityDeposit("");
    setTermAndCondition("");
    setCancellationRefundPolicy("");
    setComplimentaries([]);
    setComplimentaryMode("none");
    setCollapsedComplimentaries(new Set());
    setCreateNewComp({ name: "", price: 0, description: "", isShowPrice: false });
    setIsCreatingComp(false);
    setBonuses([]);
    setBonusMode("none");
    setCollapsedBonuses(new Set());
    setCreateNewBonus({ name: "", price: 0, description: "" });
    setIsCreatingBonus(false);
    setSignature(null);
    setCurrentStep(1);
    setErrors({});
  }

  // Populate/reset form when the drawer opens. Syncing form state to incoming
  // props on open is a legitimate effect use, so the setState calls are expected.
  useEffect(() => {
    if (isOpen && editingPackage) {
      setPackageName(editingPackage.packageName);
      setAvailable(editingPackage.available);
      setVenueId(editingPackage.venueId ?? "");
      setNotes(editingPackage.notes ?? "");
      setItems(
        (editingPackage.miceItems ?? []).map((it) => ({
          id: it.id,
          itemName: it.itemName,
          itemDescription: it.itemDescription,
        })),
      );
      setTaxDeposits(
        (editingPackage.taxDeposits ?? []).map((td) => ({
          id: td.id,
          name: td.name,
          nominal: td.nominal ? formatNumericDisplay(td.nominal) : "",
        })),
      );
      setPrices(
        (editingPackage.micePrices ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          priceType: p.priceType === "NOMINAL" ? "nominal" : "qty",
          qty: p.qty ? formatNumericDisplay(p.qty) : "",
          price: p.price ? formatNumericDisplay(p.price) : "",
          total: p.total ? formatNumericDisplay(p.total) : "",
        })),
      );
      setPaymentMethodId(editingPackage.paymentMethodId ?? "");
      setSecurityDeposit(editingPackage.securityDeposit ? formatNumericDisplay(editingPackage.securityDeposit) : "");
      setTermAndCondition(editingPackage.termAndCondition ?? "");
      setCancellationRefundPolicy(editingPackage.cancellationRefundPolicy ?? "");
      setComplimentaries(
        (editingPackage.complimentaries ?? []).map((c) => ({
          id: c.id,
          complimentaryId: c.complimentaryId,
          name: c.name,
          price: c.price,
          isShowPrice: c.isShowPrice,
          description: c.description ?? "",
          qty: c.qty,
        })),
      );
      setBonuses(
        (editingPackage.bonuses ?? []).map((b) => ({
          id: b.id,
          bonusId: b.bonusId,
          name: b.name,
          price: b.price,
          description: b.description ?? "",
          qty: b.qty,
        })),
      );
      setCollapsedItems(new Set());
      setCollapsedTaxDeposits(new Set());
      setCollapsedPrices(new Set());
      setComplimentaryMode("none");
      setCollapsedComplimentaries(new Set());
      setBonusMode("none");
      setCollapsedBonuses(new Set());
      setSignature(null);
      setCurrentStep(1);
      setErrors({});
    } else if (isOpen) {
      resetForm();
    }
  }, [isOpen, editingPackage]); // resetForm is stable (defined inside component, no deps)

  function handleClose() {
    resetForm();
    onClose();
  }

  // ─── Validation & navigation ─────────────────────────────────────────────────

  const isStep1Invalid = !packageName.trim() || !venueId;
  const isStep2Invalid = items.length === 0 || items.some((it) => !it.itemName.trim());
  const isStep3Invalid =
    prices.length === 0 ||
    prices.some(
      (p) =>
        !p.name.trim() ||
        (p.priceType === "qty" && (parseNumericInput(p.qty) < 1 || parseNumericInput(p.price) < 1)) ||
        (p.priceType === "nominal" && parseNumericInput(p.total) < 1)
    );
  // Step 4 (Payment) and Step 5 (Complimentary & Bonus) are optional — no hard validation.
  const isNextDisabled =
    submitting ||
    (currentStep === 1 && isStep1Invalid) ||
    (currentStep === 2 && isStep2Invalid) ||
    (currentStep === 3 && isStep3Invalid);

  function handleNext() {
    if (currentStep === 1) {
      const nextErrors: Record<string, string> = {};
      if (!packageName.trim()) nextErrors.packageName = "Nama paket wajib diisi";
      if (!venueId) nextErrors.venueId = "Venue wajib dipilih";
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        toast.error("Lengkapi semua field yang wajib diisi");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (items.length === 0) {
        toast.error("Tambahkan minimal satu item paket");
        return;
      }
      if (items.some((it) => !it.itemName.trim())) {
        toast.error("Setiap item wajib punya nama");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (prices.length === 0) {
        toast.error("Tambahkan minimal satu item harga");
        return;
      }
      if (prices.some((p) => !p.name.trim())) {
        toast.error("Setiap item harga wajib punya nama");
        return;
      }
      if (prices.some((p) => p.priceType === "qty" && parseNumericInput(p.qty) < 1)) {
        toast.error("Qty wajib diisi minimal 1 untuk tipe Qty × Harga");
        return;
      }
      if (prices.some((p) => p.priceType === "qty" && parseNumericInput(p.price) < 1)) {
        toast.error("Harga / unit wajib diisi untuk tipe Qty × Harga");
        return;
      }
      if (prices.some((p) => p.priceType === "nominal" && parseNumericInput(p.total) < 1)) {
        toast.error("Total wajib diisi untuk tipe Nominal");
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setCurrentStep(5);
    } else if (currentStep === 5) {
      setCurrentStep(6);
    }
  }

  function handlePrevious() {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }

  // ─── DnD — items ──────────────────────────────────────────────────────────────

  const itemSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((i) => i.id === active.id);
      const newIdx = prev.findIndex((i) => i.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // ─── DnD — tax & deposit ──────────────────────────────────────────────────────

  const taxDepositSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleTaxDepositDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTaxDeposits((prev) => {
      const oldIdx = prev.findIndex((t) => t.id === active.id);
      const newIdx = prev.findIndex((t) => t.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // ─── DnD — prices ─────────────────────────────────────────────────────────────

  const priceSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handlePriceDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPrices((prev) => {
      const oldIdx = prev.findIndex((p) => p.id === active.id);
      const newIdx = prev.findIndex((p) => p.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  // ─── Item helpers ─────────────────────────────────────────────────────────────

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${prev.length}-${Math.round(performance.now())}`,
        itemName: "",
        itemDescription: "",
      },
    ]);
  }

  function updateItem(itemId: string, field: "itemName" | "itemDescription", value: string) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)));
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  // ─── Tax & Deposit helpers ────────────────────────────────────────────────────

  function addTaxDeposit() {
    setTaxDeposits((prev) => [
      ...prev,
      {
        id: `temp-taxdeposit-${prev.length}-${Math.round(performance.now())}`,
        name: "",
        nominal: "",
      },
    ]);
  }

  function updateTaxDepositName(id: string, value: string) {
    setTaxDeposits((prev) => prev.map((t) => (t.id === id ? { ...t, name: value } : t)));
  }

  function updateTaxDepositNominal(id: string, rawValue: string) {
    setTaxDeposits((prev) => prev.map((t) => (t.id === id ? { ...t, nominal: formatNumericDisplay(rawValue) } : t)));
  }

  function removeTaxDeposit(id: string) {
    setTaxDeposits((prev) => prev.filter((t) => t.id !== id));
  }

  // ─── Price helpers ────────────────────────────────────────────────────────────

  function recomputePriceTotal(qtyRaw: string, priceRaw: string): string {
    const qty = parseNumericInput(qtyRaw);
    const price = parseNumericInput(priceRaw);
    return formatNumericDisplay(qty * price);
  }

  function addPrice() {
    setPrices((prev) => [
      ...prev,
      {
        id: `temp-price-${prev.length}-${Math.round(performance.now())}`,
        name: "",
        priceType: "qty",
        qty: "",
        price: "",
        total: "",
      },
    ]);
  }

  function updatePriceName(priceId: string, value: string) {
    setPrices((prev) => prev.map((p) => (p.id === priceId ? { ...p, name: value } : p)));
  }

  function updatePriceType(priceId: string, value: MicePriceTypeLocal) {
    setPrices((prev) =>
      prev.map((p) => {
        if (p.id !== priceId) return p;
        if (value === "qty") {
          return { ...p, priceType: value, total: recomputePriceTotal(p.qty, p.price) };
        }
        return { ...p, priceType: value };
      }),
    );
  }

  function updatePriceQty(priceId: string, rawValue: string) {
    setPrices((prev) =>
      prev.map((p) => {
        if (p.id !== priceId) return p;
        const qty = formatNumericDisplay(rawValue);
        return { ...p, qty, total: recomputePriceTotal(qty, p.price) };
      }),
    );
  }

  function updatePricePerUnit(priceId: string, rawValue: string) {
    setPrices((prev) =>
      prev.map((p) => {
        if (p.id !== priceId) return p;
        const price = formatNumericDisplay(rawValue);
        return { ...p, price, total: recomputePriceTotal(p.qty, price) };
      }),
    );
  }

  function updatePriceTotalManual(priceId: string, rawValue: string) {
    setPrices((prev) => prev.map((p) => (p.id === priceId ? { ...p, total: formatNumericDisplay(rawValue) } : p)));
  }

  function removePrice(priceId: string) {
    setPrices((prev) => prev.filter((p) => p.id !== priceId));
  }

  // ─── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!signature) {
      toast.error("Tanda tangan wajib diisi");
      return;
    }
    try {
      setSubmitting(true);
      let pkgId: string;

      const tcValue = termAndCondition.trim() && termAndCondition !== "<p></p>" ? termAndCondition : null;
      const crpValue =
        cancellationRefundPolicy.trim() && cancellationRefundPolicy !== "<p></p>" ? cancellationRefundPolicy : null;
      const securityDepositValue = parseNumericInput(securityDeposit);

      if (isEdit) {
        const res = await updatePkg.mutateAsync({
          id: editingPackage!.id,
          data: {
            packageName,
            available,
            venueId: venueId || null,
            notes: notes.trim() || null,
            paymentMethodId: paymentMethodId || null,
            ...(canEditTc
              ? { securityDeposit: securityDepositValue, termAndCondition: tcValue, cancellationRefundPolicy: crpValue }
              : {}),
            signature,
          },
        });
        if (!res.success) {
          toast.error(res.error ?? "Gagal update paket");
          return;
        }
        pkgId = editingPackage!.id;
      } else {
        const res = await createPkg.mutateAsync({
          packageName,
          available,
          venueId: venueId || null,
          notes: notes.trim() || null,
          paymentMethodId: paymentMethodId || null,
          ...(canEditTc
            ? { securityDeposit: securityDepositValue, termAndCondition: tcValue, cancellationRefundPolicy: crpValue }
            : {}),
          signature,
          category: "MICE",
        });
        if (!res.success) {
          toast.error(res.error ?? "Gagal membuat paket");
          return;
        }
        pkgId = res.data!.id;
      }

      const cleanItems = items
        .filter((it) => it.itemName.trim())
        .map((it) => ({
          itemName: it.itemName.trim(),
          itemDescription: it.itemDescription.trim(),
        }));

      await saveMiceItemsMut.mutateAsync({ packageId: pkgId, items: cleanItems });

      const cleanTaxDeposits = taxDeposits
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          nominal: parseNumericInput(t.nominal),
        }));

      await saveTaxDepositsMut.mutateAsync({ packageId: pkgId, items: cleanTaxDeposits });

      const cleanPrices = prices
        .filter((p) => p.name.trim())
        .map((p) => {
          if (p.priceType === "qty") {
            const qty = parseNumericInput(p.qty);
            const price = parseNumericInput(p.price);
            return {
              name: p.name.trim(),
              priceType: "QTY" as const,
              qty,
              price,
              total: qty * price,
            };
          }
          return {
            name: p.name.trim(),
            priceType: "NOMINAL" as const,
            qty: null,
            price: null,
            total: parseNumericInput(p.total),
          };
        });

      await saveMicePricesMut.mutateAsync({ packageId: pkgId, prices: cleanPrices });

      const cleanComplimentaries = complimentaries
        .filter((c) => c.name.trim())
        .map((c) => ({
          complimentaryId: c.complimentaryId,
          name: c.name.trim(),
          price: c.price,
          isShowPrice: c.isShowPrice,
          description: c.description.trim() || null,
          qty: c.qty,
        }));

      await saveComplimentariesMut.mutateAsync({ packageId: pkgId, items: cleanComplimentaries });

      const cleanBonuses = bonuses
        .filter((b) => b.name.trim())
        .map((b) => ({
          bonusId: b.bonusId,
          name: b.name.trim(),
          price: b.price,
          description: b.description.trim() || null,
          qty: b.qty,
        }));

      await saveBonusesMut.mutateAsync({ packageId: pkgId, items: cleanBonuses });

      toast.success(isEdit ? "Paket MICE berhasil diupdate!" : "Paket MICE berhasil dibuat!");
      handleClose();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? "Edit Paket MICE" : "Buat Paket MICE"}
      maxWidth="sm:max-w-[630px]"
      steps={currentStep}
      totalSteps={stepperSteps.length}
      stepperType="short"
    >
      <div className={cn("flex flex-col h-full")}>
        <div className={cn("flex-1 overflow-y-auto px-1")}>
          {/* ─── Step 1: Detail Paket ─── */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Nama Paket <span className={cn("text-destructive")}>*</span></Label>
                <Input
                  className={cn("mt-1", errors.packageName && "border-destructive")}
                  value={packageName}
                  onChange={(e) => {
                    setPackageName(e.target.value);
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.packageName;
                      return n;
                    });
                  }}
                  placeholder="Masukkan nama paket"
                />
                {errors.packageName && <p className={cn("mt-1 text-xs text-destructive")}>{errors.packageName}</p>}
              </div>

              {/* Venue */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Venue <span className={cn("text-destructive")}>*</span></Label>
                <SearchableSelect
                  options={venues.map((v) => ({ id: v.id, name: v.name }))}
                  value={venueId}
                  onChange={(v) => {
                    setVenueId(v);
                    setErrors((p) => {
                      const n = { ...p };
                      delete n.venueId;
                      return n;
                    });
                  }}
                  placeholder="Pilih venue"
                  searchPlaceholder="Cari venue..."
                  emptyText="Venue tidak ditemukan"
                  className={cn("mt-1 w-full", errors.venueId && "[&>button]:border-destructive")}
                />
                {errors.venueId && <p className={cn("mt-1 text-xs text-destructive")}>{errors.venueId}</p>}
                <p className={cn("mt-1.5 text-xs text-muted-foreground")}>Harga paket diatur lewat step &quot;Harga&quot; di bawah.</p>
              </div>

              {/* Catatan (opsional) */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Catatan (opsional)</Label>
                <Textarea
                  className={cn("mt-1 min-h-20")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan tentang paket"
                />
              </div>

              {/* Ketersediaan */}
              <div>
                <Label className={cn("text-sm font-medium text-foreground mb-2 block")}>Ketersediaan</Label>
                <div className={cn("flex items-center gap-3")}>
                  <Switch checked={available} onCheckedChange={setAvailable} />
                  <span className={cn("text-sm text-muted-foreground")}>{available ? "Tersedia" : "Tidak Tersedia"}</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Item Paket ─── */}
          {currentStep === 2 && (
            <Tabs defaultValue="items">
              <TabsList
                variant="line"
                className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
              >
                <TabsTrigger value="items" className={TAB_TRIGGER_CLASS}>
                  <ClipboardList weight="BoldDuotone" className="size-4 shrink-0" />
                  Items
                </TabsTrigger>
                <TabsTrigger value="tax-deposit" className={TAB_TRIGGER_CLASS}>
                  <SafeSquare weight="BoldDuotone" className="size-4 shrink-0" />
                  Tax & Deposit
                </TabsTrigger>
              </TabsList>

              {/* ── Items ─────────────────────────────────────────── */}
              <TabsContent value="items" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                <DndContext sensors={itemSensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
                  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {items.map((item) => (
                        <SortableAccordionRow
                          key={item.id}
                          id={item.id}
                          title={item.itemName}
                          placeholder="Item Baru"
                          isOpen={!collapsedItems.has(item.id)}
                          onToggleOpen={() => toggleItemCollapse(item.id)}
                          onRemove={() => removeItem(item.id)}
                        >
                          <div>
                            <Label className={cn("text-xs font-medium text-foreground block mb-1")}>
                              Item Title / Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                              value={item.itemName}
                              onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                              placeholder="Nama item"
                              className={cn("text-sm font-medium")}
                            />
                          </div>

                          <div>
                            <Label className={cn("text-xs text-muted-foreground block mb-1")}>Deskripsi (opsional)</Label>
                            <SimpleEditor
                              value={item.itemDescription}
                              onChange={(html) => updateItem(item.id, "itemDescription", html)}
                              placeholder="Deskripsi item (opsional)"
                            />
                          </div>
                        </SortableAccordionRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {items.length === 0 && (
                  <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground")}>
                    <ClipboardList weight="BoldDuotone" className={cn("h-9 w-9 mb-2 opacity-40")} />
                    <p className="text-sm">Belum ada item. Tambahkan item pertama.</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={addItem}
                  className={cn("w-full rounded-full border-dashed text-muted-foreground hover:bg-muted/50")}
                >
                  <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Item
                </Button>
              </TabsContent>

              {/* ── Tax & Deposit ─────────────────────────────────── */}
              <TabsContent value="tax-deposit" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                <DndContext sensors={taxDepositSensors} collisionDetection={closestCenter} onDragEnd={handleTaxDepositDragEnd}>
                  <SortableContext items={taxDeposits.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {taxDeposits.map((t) => (
                        <SortableAccordionRow
                          key={t.id}
                          id={t.id}
                          title={t.name}
                          placeholder="Tax / Deposit Baru"
                          isOpen={!collapsedTaxDeposits.has(t.id)}
                          onToggleOpen={() => toggleTaxDepositCollapse(t.id)}
                          onRemove={() => removeTaxDeposit(t.id)}
                        >
                          <div>
                            <Label className={cn("text-xs font-medium text-foreground block mb-1")}>Nama</Label>
                            <Input
                              value={t.name}
                              onChange={(e) => updateTaxDepositName(t.id, e.target.value)}
                              placeholder="Nama tax / deposit"
                              className={cn("text-sm font-medium")}
                            />
                          </div>

                          <div>
                            <Label className={cn("text-xs text-muted-foreground block mb-1")}>Nominal</Label>
                            <div className={cn("relative")}>
                              <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none")}>
                                Rp
                              </span>
                              <Input
                                value={t.nominal}
                                onChange={(e) => updateTaxDepositNominal(t.id, e.target.value)}
                                placeholder="0"
                                inputMode="numeric"
                                className={cn("h-8 text-sm pl-8")}
                              />
                            </div>
                          </div>
                        </SortableAccordionRow>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {taxDeposits.length === 0 && (
                  <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground")}>
                    <SafeSquare weight="BoldDuotone" className={cn("h-9 w-9 mb-2 opacity-40")} />
                    <p className="text-sm">Belum ada tax / deposit (opsional).</p>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={addTaxDeposit}
                  className={cn("w-full rounded-full border-dashed text-muted-foreground hover:bg-muted/50")}
                >
                  <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Tax / Deposit
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {/* ─── Step 3: Harga ─── */}
          {currentStep === 3 && (
            <div className="space-y-3">
              <DndContext sensors={priceSensors} collisionDetection={closestCenter} onDragEnd={handlePriceDragEnd}>
                <SortableContext items={prices.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3">
                    {prices.map((p) => (
                      <SortableAccordionRow
                        key={p.id}
                        id={p.id}
                        title={p.name}
                        placeholder="Harga Baru"
                        isOpen={!collapsedPrices.has(p.id)}
                        onToggleOpen={() => togglePriceCollapse(p.id)}
                        onRemove={() => removePrice(p.id)}
                      >
                        <div>
                          <Label className={cn("text-xs font-medium text-foreground block mb-1")}>
                            Nama <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={p.name}
                            onChange={(e) => updatePriceName(p.id, e.target.value)}
                            placeholder="Nama item harga"
                            className={cn("text-sm font-medium")}
                          />
                        </div>

                        <div>
                          <Label className={cn("text-xs text-muted-foreground")}>Tipe Harga</Label>
                          <Select value={p.priceType} onValueChange={(v) => updatePriceType(p.id, v as MicePriceTypeLocal)}>
                            <SelectTrigger className={cn("mt-1 w-full h-8 text-sm")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="qty">Qty × Harga</SelectItem>
                              <SelectItem value="nominal">Nominal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {p.priceType === "qty" && (
                          <div className={cn("grid grid-cols-2 gap-2")}>
                            <div>
                              <Label className={cn("text-xs text-muted-foreground")}>
                                Qty <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={p.qty}
                                onChange={(e) => updatePriceQty(p.id, e.target.value)}
                                placeholder="0"
                                inputMode="numeric"
                                className={cn("mt-1 h-8 text-sm")}
                              />
                            </div>
                            <div>
                              <Label className={cn("text-xs text-muted-foreground")}>
                                Harga / unit <span className="text-destructive">*</span>
                              </Label>
                              <div className={cn("relative mt-1")}>
                                <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none")}>
                                  Rp
                                </span>
                                <Input
                                  value={p.price}
                                  onChange={(e) => updatePricePerUnit(p.id, e.target.value)}
                                  placeholder="0"
                                  inputMode="numeric"
                                  className={cn("h-8 text-sm pl-8")}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <Label className={cn("text-xs text-muted-foreground")}>
                            Total {p.priceType === "nominal" && <span className="text-destructive">*</span>}
                          </Label>
                          <div className={cn("relative mt-1")}>
                            <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none")}>
                              Rp
                            </span>
                            {p.priceType === "qty" ? (
                              <Input
                                value={p.total}
                                disabled
                                readOnly
                                className={cn("h-8 text-sm pl-8 bg-muted/60 text-muted-foreground")}
                              />
                            ) : (
                              <Input
                                value={p.total}
                                onChange={(e) => updatePriceTotalManual(p.id, e.target.value)}
                                placeholder="0"
                                inputMode="numeric"
                                className={cn("h-8 text-sm pl-8")}
                              />
                            )}
                          </div>
                        </div>
                      </SortableAccordionRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {prices.length === 0 && (
                <div className={cn("flex flex-col items-center justify-center py-8 text-muted-foreground")}>
                  <TagPrice weight="BoldDuotone" className={cn("h-9 w-9 mb-2 opacity-40")} />
                  <p className="text-sm">Belum ada item harga. Tambahkan item pertama.</p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={addPrice}
                className={cn("w-full rounded-full border-dashed text-muted-foreground hover:bg-muted/50")}
              >
                <AddCircle weight="BoldDuotone" className={cn("h-4 w-4 mr-2")} />Tambah Item Harga
              </Button>
            </div>
          )}

          {/* ─── Step 4: Payment ─── */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <Label className={cn("text-sm font-medium text-foreground")}>Rekening Pembayaran</Label>
                <BankAccountSelect
                  value={paymentMethodId}
                  onChange={setPaymentMethodId}
                  venueId={venueId || undefined}
                  placeholder="Pilih rekening..."
                  className="mt-1"
                />
              </div>

              {canEditTc ? (
                <>
                  <div>
                    <Label className={cn("text-sm font-medium text-foreground")}>Security Deposit</Label>
                    <div className={cn("relative mt-1")}>
                      <span className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none")}>
                        Rp
                      </span>
                      <Input
                        value={securityDeposit}
                        onChange={(e) => setSecurityDeposit(formatNumericDisplay(e.target.value))}
                        placeholder="0"
                        inputMode="numeric"
                        className={cn("pl-8")}
                      />
                    </div>
                  </div>

                  <div className={cn("flex flex-col min-h-[220px]")}>
                    <Label className={cn("text-sm font-medium text-foreground mb-1")}>Term &amp; Payment</Label>
                    <TermConditionEditor
                      value={termAndCondition}
                      onChange={setTermAndCondition}
                      placeholder="Tulis Term & Payment di sini..."
                      className="flex-1"
                      showVariablePanel={false}
                    />
                  </div>

                  <div className={cn("flex flex-col min-h-[220px]")}>
                    <Label className={cn("text-sm font-medium text-foreground mb-1")}>Cancellation &amp; Refund Policy</Label>
                    <TermConditionEditor
                      value={cancellationRefundPolicy}
                      onChange={setCancellationRefundPolicy}
                      placeholder="Tulis Cancellation & Refund Policy di sini..."
                      className="flex-1"
                      showVariablePanel={false}
                    />
                  </div>
                </>
              ) : (
                <p className={cn("text-xs text-muted-foreground italic")}>
                  Anda tidak punya akses untuk mengubah Security Deposit, Term &amp; Payment, atau Cancellation &amp; Refund Policy paket ini.
                </p>
              )}
            </div>
          )}

          {/* ─── Step 5: Complimentary & Bonus ─── */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-card p-5">
                <Tabs defaultValue="bonus">
                  <TabsList
                    variant="line"
                    className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
                  >
                    <TabsTrigger value="bonus" className={TAB_TRIGGER_CLASS}>
                      <MedalStar weight="BoldDuotone" className="size-4 shrink-0" />
                      Bonus
                    </TabsTrigger>
                    <TabsTrigger value="complimentary" className={TAB_TRIGGER_CLASS}>
                      <Gift weight="BoldDuotone" className="size-4 shrink-0" />
                      Complimentary
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Bonus ─────────────────────────────────────────── */}
                  <TabsContent value="bonus" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {bonusMode !== "create-new" && (
                      <BonusSelect
                        options={bonusOptions
                          .filter((opt) => !bonuses.some((b) => b.bonusId === opt.id))
                          .map((opt) => ({ id: opt.id, name: opt.name, badge: formatRupiah(opt.price), description: opt.description ?? undefined }))}
                        value=""
                        onChange={(selectedId) => {
                          const found = bonusOptions.find((x) => x.id === selectedId);
                          if (found) {
                            setBonuses((prev) => [...prev, {
                              id: crypto.randomUUID(),
                              bonusId: found.id,
                              name: found.name,
                              price: found.price,
                              description: found.description ?? "",
                              qty: 1,
                            }]);
                          }
                        }}
                        onAddTrigger={canCreateBonus ? (text) => {
                          setBonusMode("create-new");
                          setCreateNewBonus({ name: text, price: 0, description: "" });
                        } : undefined}
                        placeholder="Pilih dari daftar bonus..."
                        searchPlaceholder="Cari bonus..."
                        emptyText="Tidak ada bonus"
                      />
                    )}

                    {bonusMode === "create-new" && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Tambah bonus baru ke master list</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setBonusMode("none")}
                          >
                            Batal
                          </button>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Nama <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={createNewBonus.name}
                            onChange={(e) => setCreateNewBonus((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nama bonus..."
                            className="h-8 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Harga <span className="text-destructive">*</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={createNewBonus.price ? formatNumericDisplay(createNewBonus.price) : ""}
                              onChange={(e) => {
                                const n = parseNumericInput(e.target.value);
                                setCreateNewBonus((p) => ({ ...p, price: n }));
                              }}
                              placeholder="Harga"
                              inputMode="numeric"
                              className="h-8 text-sm pl-8"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                          <Textarea
                            value={createNewBonus.description}
                            onChange={(e) => setCreateNewBonus((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Deskripsi bonus (opsional)..."
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        <Button
                          type="button"
                          className="w-full rounded-xl"
                          disabled={!createNewBonus.name.trim() || !createNewBonus.price || isCreatingBonus}
                          onClick={async () => {
                            if (!createNewBonus.name.trim() || !createNewBonus.price || isCreatingBonus) return;
                            setIsCreatingBonus(true);
                            try {
                              const result = await createBonus({
                                name: createNewBonus.name.trim(),
                                price: createNewBonus.price,
                                description: createNewBonus.description.trim() || null,
                                isActive: true,
                              });
                              if (result.success) {
                                setBonuses((prev) => [...prev, {
                                  id: crypto.randomUUID(),
                                  bonusId: result.data.id,
                                  name: result.data.name,
                                  price: result.data.price,
                                  description: result.data.description ?? "",
                                  qty: 1,
                                }]);
                                setBonusMode("none");
                                toast.success(`"${result.data.name}" berhasil ditambahkan`);
                              } else {
                                toast.error(result.error ?? "Gagal menambahkan bonus");
                              }
                            } finally {
                              setIsCreatingBonus(false);
                            }
                          }}
                        >
                          {isCreatingBonus ? "Menyimpan..." : "Simpan & Tambah"}
                        </Button>
                      </div>
                    )}

                    {bonuses.map((b) => {
                      const isOpen = !collapsedBonuses.has(b.id);
                      return (
                        <Collapsible
                          key={b.id}
                          open={isOpen}
                          onOpenChange={() => toggleBonusCollapse(b.id)}
                          className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                        >
                          <div className="flex items-center gap-1 px-3 py-2.5">
                            <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                              <AltArrowDown
                                weight="BoldDuotone"
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                  isOpen && "rotate-180",
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                                {!isOpen && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {b.price ? formatRupiah(b.price) : ""}
                                  </p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBonuses((prev) => prev.filter((x) => x.id !== b.id));
                                setCollapsedBonuses((prev) => {
                                  const next = new Set(prev);
                                  next.delete(b.id);
                                  return next;
                                });
                              }}
                              aria-label="Hapus bonus"
                              className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                  Nama <span className="text-destructive">*</span>
                                </label>
                                <Input
                                  value={b.name}
                                  onChange={(e) => setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))}
                                  placeholder="Nama bonus..."
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                  Harga <span className="text-destructive">*</span>
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                                    Rp
                                  </span>
                                  <Input
                                    value={b.price ? formatNumericDisplay(b.price) : ""}
                                    onChange={(e) => {
                                      const n = parseNumericInput(e.target.value);
                                      setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, price: n } : x));
                                    }}
                                    placeholder="Harga"
                                    inputMode="numeric"
                                    className="h-8 text-sm pl-8"
                                  />
                                </div>
                              </div>
                              <Textarea
                                value={b.description}
                                onChange={(e) => setBonuses((prev) => prev.map((x) => x.id === b.id ? { ...x, description: e.target.value } : x))}
                                placeholder="Deskripsi bonus..."
                                rows={2}
                                className="resize-none text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {bonuses.length === 0 && bonusMode === "none" && (
                      <p className="text-xs text-muted-foreground italic text-center py-1">Belum ada bonus</p>
                    )}
                  </TabsContent>

                  {/* ── Complimentary ─────────────────────────────────── */}
                  <TabsContent value="complimentary" keepMounted className="mt-4 animate-in fade-in duration-300 space-y-3">
                    {complimentaryMode !== "create-new" && (
                      <ComplimentarySelect
                        options={complimentaryOptions
                          .filter((opt) => !complimentaries.some((c) => c.complimentaryId === opt.id))
                          .map((opt) => ({ id: opt.id, name: opt.name, badge: formatRupiah(opt.price), description: opt.description ?? undefined }))}
                        value=""
                        onChange={(selectedId) => {
                          const found = complimentaryOptions.find((x) => x.id === selectedId);
                          if (found) {
                            setComplimentaries((prev) => [...prev, {
                              id: crypto.randomUUID(),
                              complimentaryId: found.id,
                              name: found.name,
                              price: found.price,
                              isShowPrice: found.isShowPrice,
                              description: found.description ?? "",
                              qty: 1,
                            }]);
                          }
                        }}
                        onAddTrigger={canCreateComplimentary ? (text) => {
                          setComplimentaryMode("create-new");
                          setCreateNewComp({ name: text, price: 0, description: "", isShowPrice: false });
                        } : undefined}
                        placeholder="Pilih dari daftar complimentary..."
                        searchPlaceholder="Cari complimentary..."
                        emptyText="Tidak ada complimentary"
                      />
                    )}

                    {complimentaryMode === "create-new" && (
                      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Tambah complimentary baru ke master list</p>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setComplimentaryMode("none")}
                          >
                            Batal
                          </button>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">
                            Nama <span className="text-destructive">*</span>
                          </label>
                          <Input
                            value={createNewComp.name}
                            onChange={(e) => setCreateNewComp((p) => ({ ...p, name: e.target.value }))}
                            placeholder="Nama complimentary..."
                            className="h-8 text-sm"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                              Rp
                            </span>
                            <Input
                              value={createNewComp.price ? formatNumericDisplay(createNewComp.price) : ""}
                              onChange={(e) => {
                                const n = parseNumericInput(e.target.value);
                                setCreateNewComp((p) => ({ ...p, price: n }));
                              }}
                              placeholder="Harga (opsional)"
                              inputMode="numeric"
                              className="h-8 text-sm pl-8"
                            />
                          </div>
                          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                            <Switch
                              checked={createNewComp.isShowPrice}
                              onCheckedChange={(v) => setCreateNewComp((p) => ({ ...p, isShowPrice: v }))}
                            />
                            <span className="text-xs text-muted-foreground">Tampilkan harga</span>
                          </label>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground block mb-1">Deskripsi</label>
                          <Textarea
                            value={createNewComp.description}
                            onChange={(e) => setCreateNewComp((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Deskripsi complimentary (opsional)..."
                            rows={2}
                            className="resize-none text-sm"
                          />
                        </div>

                        <Button
                          type="button"
                          className="w-full rounded-xl"
                          disabled={!createNewComp.name.trim() || isCreatingComp}
                          onClick={async () => {
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
                                setComplimentaries((prev) => [...prev, {
                                  id: crypto.randomUUID(),
                                  complimentaryId: result.item!.id,
                                  name: result.item!.name,
                                  price: result.item!.price,
                                  isShowPrice: result.item!.isShowPrice,
                                  description: result.item!.description ?? "",
                                  qty: 1,
                                }]);
                                setComplimentaryMode("none");
                                toast.success(`"${result.item.name}" berhasil ditambahkan`);
                              } else {
                                toast.error(result.error ?? "Gagal menambahkan complimentary");
                              }
                            } finally {
                              setIsCreatingComp(false);
                            }
                          }}
                        >
                          {isCreatingComp ? "Menyimpan..." : "Simpan & Tambah"}
                        </Button>
                      </div>
                    )}

                    {complimentaries.map((c) => {
                      const isOpen = !collapsedComplimentaries.has(c.id);
                      return (
                        <Collapsible
                          key={c.id}
                          open={isOpen}
                          onOpenChange={() => toggleComplimentaryCollapse(c.id)}
                          className="rounded-xl border border-border bg-muted/30 overflow-hidden"
                        >
                          <div className="flex items-center gap-1 px-3 py-2.5">
                            <CollapsibleTrigger className="flex flex-1 items-center gap-2 min-w-0 cursor-pointer text-left">
                              <AltArrowDown
                                weight="BoldDuotone"
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                                  isOpen && "rotate-180",
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                                {!isOpen && (
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {c.isShowPrice && c.price ? formatRupiah(c.price) : "Harga tidak ditampilkan"}
                                  </p>
                                )}
                              </div>
                            </CollapsibleTrigger>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setComplimentaries((prev) => prev.filter((x) => x.id !== c.id));
                                setCollapsedComplimentaries((prev) => {
                                  const next = new Set(prev);
                                  next.delete(c.id);
                                  return next;
                                });
                              }}
                              aria-label="Hapus complimentary"
                              className="shrink-0 h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <TrashBinTrash weight="BoldDuotone" className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <CollapsibleContent>
                            <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                              <div>
                                <label className="text-xs font-medium text-foreground block mb-1">
                                  Nama <span className="text-destructive">*</span>
                                </label>
                                <Input
                                  value={c.name}
                                  onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x))}
                                  placeholder="Nama complimentary..."
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none">
                                    Rp
                                  </span>
                                  <Input
                                    value={c.price ? formatNumericDisplay(c.price) : ""}
                                    onChange={(e) => {
                                      const n = parseNumericInput(e.target.value);
                                      setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, price: n } : x));
                                    }}
                                    placeholder="Harga"
                                    inputMode="numeric"
                                    className="h-8 text-sm pl-8"
                                  />
                                </div>
                                <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                                  <Switch
                                    checked={c.isShowPrice}
                                    onCheckedChange={(v) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, isShowPrice: v } : x))}
                                  />
                                  <span className="text-xs text-muted-foreground">Tampilkan harga</span>
                                </label>
                              </div>
                              <Textarea
                                value={c.description}
                                onChange={(e) => setComplimentaries((prev) => prev.map((x) => x.id === c.id ? { ...x, description: e.target.value } : x))}
                                placeholder="Deskripsi complimentary..."
                                rows={2}
                                className="resize-none text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                    {complimentaries.length === 0 && complimentaryMode === "none" && (
                      <p className="text-xs text-muted-foreground italic text-center py-1">Belum ada complimentary</p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}

          {/* ─── Step 6: Tanda Tangan ─── */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className={cn("border border-border rounded-xl p-4 bg-muted/40 space-y-1")}>
                <p className={cn("text-sm font-medium text-foreground")}>{packageName || "—"}</p>
                <p className={cn("text-xs text-muted-foreground")}>
                  {venues.find((v) => v.id === venueId)?.name ?? "Venue —"} · {items.filter((i) => i.itemName.trim()).length} item ·{" "}
                  {prices.filter((p) => p.name.trim()).length} harga
                </p>
              </div>
              <SignaturePad onSignature={setSignature} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn("sticky bottom-0 bg-background border-t border-border pt-4 mt-4")}>
          <div className={cn("flex gap-2")}>
            <Button
              variant="outline"
              onClick={currentStep === 1 ? handleClose : handlePrevious}
              className={cn(
                "flex-1 cursor-pointer",
                currentStep === 1
                  ? "text-destructive border-destructive hover:bg-destructive/10"
                  : "border-border text-foreground hover:bg-accent",
              )}
              disabled={submitting}
            >
              {currentStep === 1 ? "Batal" : "Sebelumnya"}
            </Button>
            <Button
              onClick={currentStep === 6 ? handleSubmit : handleNext}
              className={cn("flex-1 cursor-pointer")}
              disabled={isNextDisabled || (currentStep === 6 && !signature) || submitting}
            >
              {submitting
                ? "Menyimpan..."
                : currentStep < 6
                ? "Selanjutnya"
                : isEdit
                ? "Simpan Perubahan"
                : "Buat Paket"}
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
