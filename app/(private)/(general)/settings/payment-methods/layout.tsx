import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

export default async function PaymentMethodsLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("settings-payment-methods");
  return <>{children}</>;
}
