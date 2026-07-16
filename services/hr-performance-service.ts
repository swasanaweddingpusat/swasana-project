import type { PerformanceReviewItem, KpiItem } from "@/lib/queries/hrPerformance";

export async function fetchPerformanceReviews(): Promise<PerformanceReviewItem[]> {
  const res = await fetch("/api/hr/performance-reviews");
  if (!res.ok) throw new Error("Failed to fetch performance reviews");
  return res.json() as Promise<PerformanceReviewItem[]>;
}

export async function fetchKpis(): Promise<KpiItem[]> {
  const res = await fetch("/api/hr/kpis");
  if (!res.ok) throw new Error("Failed to fetch KPIs");
  return res.json() as Promise<KpiItem[]>;
}
