import { Suspense } from "react";
import { getOrderStatuses } from "@/lib/queries/order-status";
import { OrderStatusManager } from "./_components/order-status-manager";
import { OrderStatusLoading } from "./_components/loading";

export default function OrderStatusSettingsPage() {
  return (
    <Suspense fallback={<OrderStatusLoading />}>
      <OrderStatusContent />
    </Suspense>
  );
}

async function OrderStatusContent() {
  const data = await getOrderStatuses();
  return <OrderStatusManager initialData={data} />;
}
