import { requirePagePermission } from "@/lib/require-page-permission";
import type { ReactNode } from "react";

/**
 * Gate seluruh /finance: cukup punya SALAH SATU dari finance-ar / finance-ap.
 * Halaman spesifik (AR vs AP) memasang guard lebih ketat lewat sub-layout
 * masing-masing, jadi finance-ap tidak bisa buka AR & sebaliknya.
 */
export default async function FinanceLayout({ children }: { children: ReactNode }) {
  await requirePagePermission(["finance-ar", "finance-ap"]);
  return <>{children}</>;
}
