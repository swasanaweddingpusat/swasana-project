"use client";

import { ReportAnalyticsHeader } from "./ReportAnalyticsHeader";
import { ExecutiveOverviewSection } from "./ExecutiveOverviewSection";
import { RevenueTrendSection } from "./RevenueTrendSection";
import { PerformanceListsSection } from "./PerformanceListsSection";
import { CancelPipelineMiceSection } from "./CancelPipelineMiceSection";
import { TargetForecastSection } from "./TargetForecastSection";

// Dashboard Report & Analytics — DESIGN-ONLY preview.
// Semua data yang ditampilkan di sini adalah dummy/mock hardcoded
// (lihat report-analytics-mock-data.ts). Belum ada query DB sama sekali;
// wiring data asli dikerjakan terpisah setelah layout ini di-acc.
export function ReportAnalyticsDashboard() {
  return (
    <div className="flex flex-col gap-6 pt-3 pb-6">
      <ReportAnalyticsHeader />
      <ExecutiveOverviewSection />
      <RevenueTrendSection />
      <PerformanceListsSection />
      <CancelPipelineMiceSection />
      <TargetForecastSection />
    </div>
  );
}
