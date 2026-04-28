"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Users, Settings, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PackageQueryItem } from "@/lib/queries/packages";

type PackageVariant = PackageQueryItem["variants"][number];
type VendorItem = PackageVariant["vendorItems"][number];
type InternalItem = PackageVariant["internalItems"][number];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

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

type Tab = "overview" | "vendor-items" | "internal-items";

export function DetailModal({ open, onClose, pkg, onEdit }: DetailModalProps) {
  const [tab, setTab] = useState<Tab>("overview");

  if (!pkg) return null;

  const tabs: { key: Tab; label: string; icon: typeof Package }[] = [
    { key: "overview", label: "Overview", icon: Package },
    { key: "vendor-items", label: "Vendor Items", icon: Users },
    { key: "internal-items", label: "Internal Items", icon: Settings },
  ];

  const priceRange = () => {
    // Extract prices from all variants' category prices
    const prices: number[] = [];
    (pkg?.variants ?? []).forEach((variant) => {
      const categoryPrices = (variant as any).package_variant_category_prices ?? [];
      categoryPrices.forEach((cp: { basePrice: number }) => {
        if (cp.basePrice > 0) prices.push(cp.basePrice);
      });
    });
    if (prices.length === 0) return "-";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatCurrency(min) : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl! max-h-[80vh] overflow-hidden flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle>{pkg.packageName}</DialogTitle>
            <button onClick={onClose} className="p-1 rounded-full bg-red-100 hover:bg-red-200 cursor-pointer">
              <X className="h-5 w-5 text-red-500" />
            </button>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 cursor-pointer",
                tab === t.key ? "border-black text-black" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Overview */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-sm">Venue</p>
                  <p className="font-medium">{pkg.venue?.name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Variants</p>
                  <p className="font-medium">{pkg.variants?.length ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Price Range</p>
                  <p className="font-medium">{priceRange()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Status</p>
                  <span className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                    pkg.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  )}>
                    {pkg.available ? "Available" : "Not Available"}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Created</p>
                  <p className="font-medium">{formatDate(pkg.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Updated</p>
                  <p className="font-medium">{formatDate(pkg.updatedAt)}</p>
                </div>
              </div>

              <hr />

              {/* Variants */}
              <div>
                <h3 className="font-semibold mb-3">Package Variants</h3>
                {pkg.variants && pkg.variants.length > 0 ? (
                  <div className="space-y-2">
                    {pkg.variants.map((v: PackageVariant) => (
                      <div key={v.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-4 border">
                        <div>
                          <h4 className="font-medium">{v.variantName}</h4>
                          <p className="text-sm text-muted-foreground">{v.pax} PAX</p>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-xs font-medium",
                          v.available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        )}>
                          {v.available ? "Available" : "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm italic">No variants</p>
                )}
              </div>

              {/* Notes */}
              {pkg.notes && (
                <>
                  <hr />
                  <div>
                    <h3 className="font-semibold mb-3">Notes</h3>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm leading-relaxed">{pkg.notes}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Vendor Items */}
          {tab === "vendor-items" && (
            <div className="space-y-4">
              {pkg.variants && pkg.variants.length > 0 ? (
                pkg.variants.map((v: PackageVariant) => {
                  const items = v.vendorItems ?? [];
                  const grouped: Record<string, VendorItem[]> = {};
                  items.forEach((item: VendorItem) => {
                    if (!grouped[item.categoryName]) grouped[item.categoryName] = [];
                    grouped[item.categoryName].push(item);
                  });

                  return (
                    <div key={v.id} className="border rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium">{v.variantName}</h4>
                        <p className="text-sm text-muted-foreground">{v.pax} PAX</p>
                      </div>
                      {Object.keys(grouped).length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm">No vendor items</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {Object.entries(grouped).map(([cat, catItems]) => (
                            <div key={cat} className="border rounded-lg p-3 bg-muted/30">
                              <h5 className="font-medium text-sm mb-2">{cat}</h5>
                              <div className="space-y-1">
                                {catItems.map((item: VendorItem) => (
                                  <div key={item.id} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full mt-2 shrink-0" />
                                    <p className="text-sm">{item.itemText}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">No variants</div>
              )}
            </div>
          )}

          {/* Internal Items */}
          {tab === "internal-items" && (
            <div className="space-y-4">
              {pkg.variants && pkg.variants.length > 0 ? (
                pkg.variants.map((v: PackageVariant) => {
                  const items = v.internalItems ?? [];
                  return (
                    <div key={v.id} className="border rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium">{v.variantName}</h4>
                        <p className="text-sm text-muted-foreground">{v.pax} PAX</p>
                      </div>
                      {items.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                          <Settings className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-sm">No internal items</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item: InternalItem) => (
                            <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                              <h5 className="font-medium text-sm">{item.itemName}</h5>
                              {item.itemDescription && (
                                <p className="text-xs text-muted-foreground mt-1">{item.itemDescription}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">No variants</div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex-row justify-end gap-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" /> Close
          </Button>
          {onEdit && (
            <Button onClick={() => onEdit(pkg.id)} className="gap-2">
              <Pencil className="w-4 h-4" /> Edit Package
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
