"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Settings, X, Pencil } from "lucide-react";
import { getPackageCreatedBy } from "@/actions/package";
import type { PackageQueryItem } from "@/lib/queries/packages";

type PackageVariant = PackageQueryItem["variants"][number];
type VendorItem = PackageVariant["vendorItems"][number];
type InternalItem = PackageVariant["internalItems"][number];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const variantSellingPrice = (v: PackageVariant) => {
  const base = (v.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
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
    setCreatedByName(null);
    getPackageCreatedBy(pkg.id).then(setCreatedByName);
  }, [open, pkg]);

  if (!pkg) return null;

  const priceRange = () => {
    if (!pkg.variants?.length) return "-";
    const prices = pkg.variants.map((v: PackageVariant) => variantSellingPrice(v));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl! max-h-[85vh] overflow-hidden flex flex-col gap-0 p-0" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-lg">{pkg.packageName}</DialogTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{pkg.venue?.name ?? "No venue"}</span>
                <span>·</span>
                <span>{pkg.variants?.length ?? 0} variant</span>
                <span>·</span>
                <span>{priceRange()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={pkg.available ? "default" : "secondary"}>
                {pkg.available ? "Available" : "Not Available"}
              </Badge>
              <button onClick={onClose} className="p-1 rounded-full bg-red-100 hover:bg-red-200 cursor-pointer">
                <X className="h-5 w-5 text-red-500" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden">
          <TabsList variant="line" className="px-6 w-full justify-start rounded-none border-b h-11 gap-0">
            <TabsTrigger value="overview" className="gap-1.5 px-4">
              <Package className="h-4 w-4" />Overview
            </TabsTrigger>
            <TabsTrigger value="vendor-items" className="gap-1.5 px-4">
              <Users className="h-4 w-4" />Vendor Items
            </TabsTrigger>
            <TabsTrigger value="internal-items" className="gap-1.5 px-4">
              <Settings className="h-4 w-4" />Internal Items
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Overview */}
            <TabsContent value="overview" className="space-y-5 mt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Venue", value: pkg.venue?.name ?? "-" },
                  { label: "Variants", value: pkg.variants?.length ?? 0 },
                  { label: "Price Range", value: priceRange() },
                  { label: "Created", value: formatDate(pkg.createdAt) },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Package Variants</h3>
                {pkg.variants?.length ? (
                  <div className="space-y-2">
                    {pkg.variants.map((v: PackageVariant) => (
                      <div key={v.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{v.variantName}</p>
                          <p className="text-xs text-muted-foreground">{v.pax} PAX</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium">{formatCurrency(variantSellingPrice(v))}</p>
                          <Badge variant={v.available ? "default" : "secondary"} className="text-xs">
                            {v.available ? "Available" : "N/A"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No variants</p>
                )}
              </div>

              {pkg.notes && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Notes</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">{pkg.notes}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 pb-1 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>Dibuat oleh: <span className="font-medium text-foreground">{createdByName ?? "—"}</span></span>
                <span>{formatDate(pkg.createdAt)}</span>
              </div>
            </TabsContent>

            {/* Vendor Items */}
            <TabsContent value="vendor-items" className="space-y-4 mt-0">
              {pkg.variants?.length ? (
                pkg.variants.map((v: PackageVariant) => {
                  const grouped: Record<string, VendorItem[]> = {};
                  (v.vendorItems ?? []).forEach((item: VendorItem) => {
                    if (!grouped[item.categoryName]) grouped[item.categoryName] = [];
                    grouped[item.categoryName].push(item);
                  });

                  return (
                    <div key={v.id} className="border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                        <p className="text-sm font-medium">{v.variantName}</p>
                        <p className="text-xs text-muted-foreground">{v.pax} PAX · {formatCurrency(variantSellingPrice(v))}</p>
                      </div>
                      <div className="p-4">
                        {Object.keys(grouped).length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Users className="h-7 w-7 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No vendor items</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {Object.entries(grouped).map(([cat, catItems]) => (
                              <div key={cat}>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{cat}</p>
                                <div className="space-y-1 pl-3 border-l-2 border-border">
                                  {catItems.map((item: VendorItem) => (
                                    <p key={item.id} className="text-sm" dangerouslySetInnerHTML={{ __html: item.itemText }} />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">No variants</div>
              )}
            </TabsContent>

            {/* Internal Items */}
            <TabsContent value="internal-items" className="space-y-4 mt-0">
              {pkg.variants?.length ? (
                pkg.variants.map((v: PackageVariant) => (
                  <div key={v.id} className="border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
                      <p className="text-sm font-medium">{v.variantName}</p>
                      <p className="text-xs text-muted-foreground">{v.pax} PAX · {formatCurrency(variantSellingPrice(v))}</p>
                    </div>
                    <div className="p-4">
                      {(v.internalItems ?? []).length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Settings className="h-7 w-7 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No internal items</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(v.internalItems ?? []).map((item: InternalItem) => (
                            <div key={item.id} className="border rounded-lg px-4 py-3">
                              <p className="text-sm font-medium">{item.itemName}</p>
                              {item.itemDescription && (
                                <p className="text-xs text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: item.itemDescription }} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">No variants</div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t flex-row justify-end gap-2">
          {onEdit && (
            <Button onClick={() => onEdit(pkg.id)} size="sm" className="gap-1.5">
              <Pencil className="w-4 h-4" />Edit Package
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
