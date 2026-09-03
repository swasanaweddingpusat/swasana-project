"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Box, CloseCircle, Pen, ClipboardList, MapPoint, FileText } from "@solar-icons/react";
import { cn } from "@/lib/utils";
import type { PackageQueryItem } from "@/lib/queries/packages";

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

function getMiceBasePrice(pkg: PackageQueryItem): number {
  return (pkg.categoryPrices ?? []).reduce((s, c) => s + Number(c.basePrice), 0);
}

function getMiceSellingPrice(pkg: PackageQueryItem): number {
  if (pkg.sellingPrice > 0) return pkg.sellingPrice;
  const base = getMiceBasePrice(pkg);
  return base + Math.round(base * ((pkg.margin ?? 0) / 100));
}

interface MicePackageDetailModalProps {
  open: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
  onEdit?: (id: string) => void;
}

export function MicePackageDetailModal({ open, onClose, pkg, onEdit }: MicePackageDetailModalProps) {
  if (!pkg) return null;

  const miceItems = (pkg.miceItems ?? []).filter((i) => i.itemName.trim());
  const basePrice = getMiceBasePrice(pkg);
  const sellingPrice = getMiceSellingPrice(pkg);
  const hasPrice = sellingPrice > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl! max-h-[88vh] overflow-hidden flex flex-col gap-0 p-0" showCloseButton={false}>
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <DialogTitle className="text-lg truncate">{pkg.packageName}</DialogTitle>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPoint weight="BoldDuotone" className="h-3 w-3" />{pkg.venue?.name ?? "Venue —"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClipboardList weight="BoldDuotone" className="h-3 w-3" />{miceItems.length} item
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Badge variant={pkg.available ? "default" : "secondary"}>
                {pkg.available ? "Tersedia" : "Tidak Tersedia"}
              </Badge>
              {onEdit && (
                <Button variant="outline" size="sm" onClick={() => onEdit(pkg.id)} className="gap-1.5">
                  <Pen weight="BoldDuotone" className="h-3.5 w-3.5" />Edit
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Tutup">
                <CloseCircle weight="BoldDuotone" className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Harga Jual */}
        <div className="px-6 py-3 border-b flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Harga Jual</p>
            <p className="text-xs text-muted-foreground/80">
              {hasPrice ? `Harga pokok ${formatCurrency(basePrice)}` : "Harga belum diset"}
            </p>
          </div>
          <p className="text-lg font-heading font-semibold text-foreground tabular-nums shrink-0">
            {hasPrice ? formatCurrency(sellingPrice) : "—"}
          </p>
        </div>

        {/* Notes (if any) */}
        {pkg.notes && (
          <div className="px-6 py-3 border-b bg-muted/20">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Catatan</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{pkg.notes}</p>
          </div>
        )}

        {/* Term & Payment (if any) */}
        {pkg.termAndCondition && (
          <div className="px-6 py-3 border-b">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <FileText weight="BoldDuotone" className="h-3.5 w-3.5" />
              Term & Payment
            </p>
            <div
              className="text-xs leading-relaxed rounded-md border bg-muted/20 p-3 max-h-64 overflow-y-auto [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_strong]:font-semibold"
              dangerouslySetInnerHTML={{ __html: pkg.termAndCondition }}
            />
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            <ClipboardList weight="BoldDuotone" className="h-3.5 w-3.5" />
            <span>Item Paket ({miceItems.length})</span>
          </div>

          {miceItems.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
              <Box weight="BoldDuotone" className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada item paket</p>
            </div>
          ) : (
            <div className="space-y-2">
              {miceItems.map((item, idx) => (
                <div key={item.id} className={cn("rounded-xl border bg-muted/20 px-4 py-3")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary")}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{item.itemName}</p>
                      {item.itemDescription.trim() && (
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.itemDescription}</p>
                      )}
                    </div>
                    {item.itemPrice > 0 && (
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(item.itemPrice)}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {item.itemType === "PAX" ? "/ pax" : "nominal"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
