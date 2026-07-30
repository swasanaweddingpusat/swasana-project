import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

/** AR pages: butuh finance-ar. finance-ap murni tidak bisa masuk. */
export default async function AccountsReceivableLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("finance-ar");
  return <>{children}</>;
}
