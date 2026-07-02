import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";
import { FinanceTabNav } from "./_components/FinanceTabNav";

export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance-ar");
  return (
    <>
      <FinanceTabNav />
      {children}
    </>
  );
}
