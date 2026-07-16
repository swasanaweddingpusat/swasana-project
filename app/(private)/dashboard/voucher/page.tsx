import { Suspense } from "react";
import type { Metadata } from "next";
import { getPromoPrograms } from "@/lib/queries/promo";
import { DiscountPromoManager } from "./_components/discount-promo-manager";
import { requirePagePermission } from "@/lib/require-page-permission";

export const metadata: Metadata = {
  title: "Voucher / Program - SWASANA",
  description: "Program voucher & discount aktif untuk booking",
};

export default async function DiscountPromoPage(): Promise<React.JSX.Element> {
  await requirePagePermission("promo");
  return (
    <Suspense fallback={null}>
      <DiscountPromoContent />
    </Suspense>
  );
}

async function DiscountPromoContent(): Promise<React.JSX.Element> {
  const data = await getPromoPrograms();
  return <DiscountPromoManager initialData={data} />;
}
