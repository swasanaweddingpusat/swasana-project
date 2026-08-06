"use client";

import { DrawerFinanceBase } from "@/components/shared/DrawerFinanceBase";
import { Box } from "@solar-icons/react";
import type { PackageQueryItem } from "@/lib/queries/packages";
import { useSavePackagePrices } from "@/hooks/use-packages";

interface MicePackageFinanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: PackageQueryItem | null;
}

export function MicePackageFinanceDrawer({ isOpen, onClose, pkg }: MicePackageFinanceDrawerProps) {
  const savePackagePricesMut = useSavePackagePrices();

  if (!pkg) return null;

  // Map pkg.categoryPrices → DrawerFinanceBase's categories prop shape.
  const initialCategories =
    pkg.categoryPrices && pkg.categoryPrices.length > 0
      ? pkg.categoryPrices.map((c) => ({
          categoryId: c.categoryId ?? null,
          categoryName: c.categoryName,
          basePrice: Number(c.basePrice),
          sortOrder: c.sortOrder ?? 0,
          isShow: c.isShow ?? true,
        }))
      : [];

  const initialMargin = pkg.margin ?? 0;
  const initialSellingPrice =
    pkg.sellingPrice && Number(pkg.sellingPrice) > 0 ? Number(pkg.sellingPrice) : 0;

  return (
    <DrawerFinanceBase
      isOpen={isOpen}
      onClose={onClose}
      categories={initialCategories}
      contextLabel={pkg.packageName}
      venueName={pkg.venue?.name ?? undefined}
      headerIcon={<Box weight="BoldDuotone" className="h-4 w-4" />}
      initialMargin={initialMargin}
      initialSellingPrice={initialSellingPrice}
      isSaving={savePackagePricesMut.isPending}
      onSave={async ({ categories, margin, sellingPrice }) => {
        const res = await savePackagePricesMut.mutateAsync({
          packageId: pkg.id,
          categories,
          margin,
          sellingPrice,
        });
        return res;
      }}
    />
  );
}
