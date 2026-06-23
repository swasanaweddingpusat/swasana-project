import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";
import { FinanceSidebar } from "./_components/FinanceSidebar";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance-ar");
  return (
    <div className="flex flex-col lg:flex-row lg:items-start">
      <FinanceSidebar />
      <div className="min-w-0 flex-1 lg:pl-6">{children}</div>
    </div>
  );
}
