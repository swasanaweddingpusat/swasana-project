import { Suspense } from "react";
import { connection } from "next/server";
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
  await connection();
  const data = await getOrderStatuses();
  return <OrderStatusManager initialData={data} />;
}
