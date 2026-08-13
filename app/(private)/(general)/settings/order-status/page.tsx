import { Suspense } from "react";
import { connection } from "next/server";
import { getOrderStatuses } from "@/lib/queries/order-status";
import { OrderStatusManager } from "./_components/order-status-manager";
import { OrderStatusLoading } from "./_components/loading";
import { requirePagePermission } from "@/lib/require-page-permission";

export default function OrderStatusSettingsPage() {
  return (
    <Suspense fallback={<OrderStatusLoading />}>
      <OrderStatusContent />
    </Suspense>
  );
}

async function OrderStatusContent() {
  await requirePagePermission("settings-order-status");
  await connection();
  const data = await getOrderStatuses();
  return <OrderStatusManager initialData={data} />;
}
