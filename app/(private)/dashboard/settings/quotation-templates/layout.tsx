import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

export default async function QuotationTemplatesLayout({ children }: { children: ReactNode }) {
  await requirePagePermission("settings-quotation-templates");
  return <>{children}</>;
}
