import { getOrderStatuses } from "@/lib/queries/order-status";
import { OrderStatusManager } from "./_components/order-status-manager";

export default async function OrderStatusSettingsPage() {
  const data = await getOrderStatuses();
  return <OrderStatusManager initialData={data} />;
}
