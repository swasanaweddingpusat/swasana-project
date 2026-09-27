// FILE: services/kpiInsentifService.ts

import type {
  KpiAssignmentItem,
  KpiCalculationResultItem,
  ProfileForAssignment,
  KpiAwardWinnerItem,
  KpiAwardCandidateItem,
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

export async function fetchProfilesForAssignment(
  businessRole?: "sales" | "manager"
): Promise<ProfileForAssignment[]> {
  const qs = businessRole ? `?businessRole=${businessRole}` : "";
  return fetchJson<ProfileForAssignment[]>(`/api/kpi-insentif/profiles${qs}`);
}

export interface AwardWinnerFilters {
  awardId?: string;
  period?: string;
  profileId?: string;
}

export async function fetchAwardWinners(
  filters?: AwardWinnerFilters
): Promise<KpiAwardWinnerItem[]> {
  const sp = new URLSearchParams();
  if (filters?.awardId) sp.set("awardId", filters.awardId);
  if (filters?.period) sp.set("period", filters.period);
  if (filters?.profileId) sp.set("profileId", filters.profileId);
  const qs = sp.toString();
  return fetchJson<KpiAwardWinnerItem[]>(`/api/kpi-insentif/award-winners${qs ? `?${qs}` : ""}`);
}

export async function fetchAwardCandidates(
  awardId: string,
  period: string
): Promise<KpiAwardCandidateItem[]> {
  const sp = new URLSearchParams({ awardId, period });
  return fetchJson<KpiAwardCandidateItem[]>(`/api/kpi-insentif/award-candidates?${sp.toString()}`);
}
