import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

/** AP pages (expense, outstanding, event, customer payout): butuh finance-ap. */
export default async function AccountsPayableLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance-ap");
  return <>{children}</>;
}
