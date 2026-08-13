import type { Metadata } from "next";
import { requirePagePermission } from "@/lib/require-page-permission";
import { ReportAnalyticsDashboard } from "./_components/ReportAnalyticsDashboard";

export const metadata: Metadata = { title: "Report & Analytics" };

export default async function FinanceReportAnalyticsPage() {
  await requirePagePermission(["finance-ar", "finance-ap"]);
  return <ReportAnalyticsDashboard />;
}
