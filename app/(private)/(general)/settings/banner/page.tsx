import { Suspense } from "react";
import { getBanners } from "@/lib/queries/banners";
import { BannerManager } from "./_components/banner-manager";
import { BannerLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function BannerSettingsPage() {
  await requirePagePermission("settings-banner");
  return (
    <Suspense fallback={<BannerLoading />}>
      <BannerContent />
    </Suspense>
  );
}

async function BannerContent() {
  const data = await getBanners();
  return <BannerManager initialData={data} />;
}
