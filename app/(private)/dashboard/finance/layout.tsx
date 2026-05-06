import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance-ar");
  return <>{children}</>;
}
