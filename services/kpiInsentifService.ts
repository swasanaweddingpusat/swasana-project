// FILE: services/kpiInsentifService.ts

import type {
  KpiAssignmentItem,
  KpiCalculationResultItem,
  ProfileForAssignment,
} from "@/types/kpiInsentif";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch error ${res.status}: ${url}`);
  return res.json() as Promise<T>;
}

export interface AssignmentFilters {
  profileId?: string;
  period?: string;
  kpiMasterId?: string;
  venueId?: string;
  isDraft?: boolean;
}

export interface ResultFilters {
  profileId?: string;
  period?: string;
  status?: string;
  venueId?: string;
  businessRole?: string;
}

export async function fetchKpiAssignments(
  filters?: AssignmentFilters
): Promise<KpiAssignmentItem[]> {
  const sp = new URLSearchParams();
  if (filters?.profileId) sp.set("profileId", filters.profileId);
  if (filters?.period) sp.set("period", filters.period);
  if (filters?.kpiMasterId) sp.set("kpiMasterId", filters.kpiMasterId);
  if (filters?.venueId) sp.set("venueId", filters.venueId);
  if (filters?.isDraft !== undefined) sp.set("isDraft", String(filters.isDraft));
  const qs = sp.toString();
  return fetchJson<KpiAssignmentItem[]>(`/api/kpi-insentif/assignments${qs ? `?${qs}` : ""}`);
}

export async function fetchKpiResults(
  filters?: ResultFilters
): Promise<KpiCalculationResultItem[]> {
  const sp = new URLSearchParams();
  if (filters?.profileId) sp.set("profileId", filters.profileId);
  if (filters?.period) sp.set("period", filters.period);
  if (filters?.status) sp.set("status", filters.status);
  if (filters?.venueId) sp.set("venueId", filters.venueId);
  if (filters?.businessRole) sp.set("businessRole", filters.businessRole);
  const qs = sp.toString();
  return fetchJson<KpiCalculationResultItem[]>(`/api/kpi-insentif/results${qs ? `?${qs}` : ""}`);
}

export async function fetchProfilesForAssignment(): Promise<ProfileForAssignment[]> {
  return fetchJson<ProfileForAssignment[]>("/api/kpi-insentif/profiles");
}
