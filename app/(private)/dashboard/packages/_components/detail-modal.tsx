"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Settings, X, Pencil, FileText, Calendar, MapPin, Tag } from "lucide-react";
import { getPackageCreatedBy } from "@/actions/package";
import { cn } from "@/lib/utils";
import type { PackageQueryItem } from "@/lib/queries/packages";

type PackageVariant = PackageQueryItem["variants"][number];
type VendorItem = PackageVariant["vendorItems"][number];
type InternalItem = PackageVariant["internalItems"][number];
type CategoryPrice = PackageVariant["categoryPrices"][number];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const variantBasePrice = (v: PackageVariant) =>
  (v.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);

const variantSellingPrice = (v: PackageVariant) => {
  if (v.sellingPrice > 0) return v.sellingPrice;
  const base = variantBasePrice(v);
  return base + Math.round(base * ((v.margin ?? 0) / 100));
};

const formatDate = (d: Date | string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
  onEdit?: (id: string) => void;
}

export function DetailModal({ open, onClose, pkg, onEdit }: DetailModalProps) {
  const [createdByName, setCreatedByName] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pkg) return;
    getPackageCreatedBy(pkg.id).then(setCreatedByName).catch(() => setCreatedByName(null));
    return () => { setCreatedByName(null); };
  }, [open, pkg]);

  if (!pkg) return null;

  const priceRange = () => {
    if (!pkg.variants?.length) return "-";
    const prices = pkg.variants.map((v: PackageVariant) => variantSellingPrice(v));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
  };

  const variants = pkg.variants ?? [];
  const defaultTab = variants[0]?.id ?? "";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl! max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <DialogTitle className="text-lg truncate">{pkg.packageName}</DialogTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{pkg.venue?.name ?? "No venue"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3" />{variants.length} variant
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />Updated {formatDate(pkg.updatedAt)}
                </span>
                {createdByName && (
                  <span className="inline-flex items-center gap-1">
                    by <span className="font-medium text-foreground">{createdByName}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <p className="text-sm font-semibold text-foreground">{priceRange()}</p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    pkg.approvalStatus === "approved" ? "bg-primary" :
                    pkg.approvalStatus === "rejected" ? "bg-destructive" : "bg-muted-foreground"
                  )} />
                  <span className="capitalize">{pkg.approvalStatus ?? "draft"}</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={pkg.available ? "default" : "secondary"}>
                {pkg.available ? "Available" : "Not Available"}
              </Badge>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(pkg.id)} className="gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />Edit
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Notes (if any) */}
        {pkg.notes && (
          <div className="px-6 py-3 border-b bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{pkg.notes}</p>
          </div>
        )}

        {/* Variant Tabs */}
        {variants.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No variants yet</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 overflow-hidden">
            <TabsList variant="line" className="px-6 w-full justify-start rounded-none border-b h-11 gap-1 shrink-0 overflow-x-auto">
              {variants.map((v) => (
                <TabsTrigger key={v.id} value={v.id} className="px-4 shrink-0">
                  {v.variantName}
                </TabsTrigger>
              ))}
            </TabsList>

            {variants.map((v) => (
              <TabsContent key={v.id} value={v.id} className="flex-1 overflow-y-auto mt-0 p-6 space-y-5 data-state-inactive:hidden">
                <VariantContent variant={v} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Variant Content ──────────────────────────────────────────────────────────

function VariantContent({ variant: v }: { variant: PackageVariant }) {
  const basePrice = variantBasePrice(v);
  const sellingPrice = variantSellingPrice(v);
  const categoryPrices = [...(v.categoryPrices ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <>
      {/* Status summary bar */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{v.variantName}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{v.pax} PAX</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatCurrency(sellingPrice)}</span>
          <Badge variant={v.available ? "default" : "secondary"} className="text-xs">
            {v.available ? "Available" : "N/A"}
          </Badge>
        </div>
      </div>

      {/* Price Breakdown */}
      {categoryPrices.length > 0 && (
        <SectionBlock title="Price Breakdown" icon={<Tag className="h-3.5 w-3.5" />}>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {categoryPrices.map((cp: CategoryPrice) => (
                  <tr key={cp.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{cp.categoryName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(Number(cp.basePrice))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 border-t-2">
                <tr>
                  <td className="px-3 py-2 font-medium">Base Price</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(basePrice)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">Margin ({v.margin ?? 0}%)</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    +{formatCurrency(sellingPrice - basePrice)}
                  </td>
                </tr>
                <tr className="border-t bg-primary/5">
                  <td className="px-3 py-2 font-semibold">Selling Price</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(sellingPrice)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionBlock>
      )}

      {/* Vendor Items */}
      <VendorItemsSection items={v.vendorItems ?? []} />

      {/* Internal Items */}
      <InternalItemsSection items={v.internalItems ?? []} />

      {/* Term & Condition */}
      {v.termAndCondition && (
        <SectionBlock title="Term & Condition" icon={<FileText className="h-3.5 w-3.5" />}>
          <div
            className="text-xs leading-relaxed rounded-md border bg-muted/20 p-3 max-h-64 overflow-y-auto [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: v.termAndCondition }}
          />
        </SectionBlock>
      )}
    </>
  );
}

// ─── Helper Sub-components ────────────────────────────────────────────────────

interface SectionBlockProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function SectionBlock({ title, icon, children }: SectionBlockProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function VendorItemsSection({ items }: { items: VendorItem[] }) {
  const grouped: Record<string, VendorItem[]> = {};
  items.forEach((item) => {
    if (!grouped[item.categoryName]) grouped[item.categoryName] = [];
    grouped[item.categoryName].push(item);
  });
  const categories = Object.keys(grouped);

  return (
    <SectionBlock
      title={`Vendor Items (${categories.length} categor${categories.length === 1 ? "y" : "ies"})`}
      icon={<Users className="h-3.5 w-3.5" />}
    >
      {categories.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} label="No vendor items" />
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat} className="rounded-md border overflow-hidden">
              <div className="px-3 py-1.5 bg-muted/40 border-b">
                <p className="text-xs font-semibold">{cat}</p>
              </div>
              <div className="px-3 py-2 space-y-1">
                {grouped[cat].map((item) => (
                  <div
                    key={item.id}
                    className="text-xs leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: item.itemText }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionBlock>
  );
}

function InternalItemsSection({ items }: { items: InternalItem[] }) {
  return (
    <SectionBlock
      title={`Internal Items (${items.length})`}
      icon={<Settings className="h-3.5 w-3.5" />}
    >
      {items.length === 0 ? (
        <EmptyState icon={<Settings className="h-6 w-6" />} label="No internal items" />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border px-3 py-2">
              <p className="text-xs font-semibold mb-0.5">{item.itemName}</p>
              {item.itemDescription && (
                <div
                  className="text-xs text-muted-foreground leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5"
                  dangerouslySetInnerHTML={{ __html: item.itemDescription }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </SectionBlock>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="text-center py-5 text-muted-foreground border-2 border-dashed rounded-md">
      <div className="opacity-30 mx-auto w-fit">{icon}</div>
      <p className="text-xs mt-1.5">{label}</p>
    </div>
  );
}
