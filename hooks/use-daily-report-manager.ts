"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createDailyReport,
  updateDailyReport,
  deleteDailyReport,
} from "@/actions/daily-report-manager";
import type {
  CreateDailyReportInput,
  UpdateDailyReportInput,
} from "@/lib/validations/daily-report-manager";

// ─────────────────────────────────────────────────────────────────────────────
// Shared types (mirroring API / query shapes)
// ─────────────────────────────────────────────────────────────────────────────

export type DailyReportStatus = "ON_TRACK" | "OFF_TRACK" | "AT_RISK";

export interface DailyReportListItem {
  id: string;
  reportDate: string;
  status: DailyReportStatus;
  totalClientDihubungi: number;
  totalHotProspect: number;
  totalLeadsBaru: number;
  totalFollowUp: number;
  totalPotensiClosing: number;
  closingHariIni: number;
  actionBesok: string | null;
  commitVisit: string | null;
  actualVisit: string | null;
  reason: string | null;
  kendala: string | null;
  membersCompleted: string[];
  membersTotal: number;
  submittedBy: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DailyReportListResult {
  data: DailyReportListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface DailyReportMetrics {
  totalClientDihubungi: number;
  totalHotProspect: number;
  totalLeadsBaru: number;
  totalFollowUp: number;
  totalPotensiClosing: number;
  closingHariIni: number;
}

export interface MemberCompletionItem {
  profileId: string;
  fullName: string | null;
  avatarUrl: string | null;
  hasLoggedActivity: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchReports(
  groupId: string,
  page: number,
): Promise<DailyReportListResult> {
  const params = new URLSearchParams({
    groupId,
    action: "list",
    page: String(page),
  });
  const res = await fetch(`/api/daily-report-manager?${params.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data laporan");
  return res.json() as Promise<DailyReportListResult>;
}

async function fetchMetrics(
  groupId: string,
  date: string,
): Promise<DailyReportMetrics> {
  const params = new URLSearchParams({ groupId, action: "metrics", date });
  const res = await fetch(`/api/daily-report-manager?${params.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat metrik laporan");
  return res.json() as Promise<DailyReportMetrics>;
}

async function fetchCompletion(
  groupId: string,
  date: string,
): Promise<MemberCompletionItem[]> {
  const params = new URLSearchParams({ groupId, action: "completion", date });
  const res = await fetch(`/api/daily-report-manager?${params.toString()}`);
  if (!res.ok) throw new Error("Gagal memuat data anggota");
  return res.json() as Promise<MemberCompletionItem[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useDailyReports(groupId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["daily-report-manager", "list", groupId, page],
    queryFn: () => fetchReports(groupId!, page),
    enabled: !!groupId,
    staleTime: 0,
  });
}

export function useDailyReportMetrics(
  groupId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: ["daily-report-manager", "metrics", groupId, date],
    queryFn: () => fetchMetrics(groupId!, date!),
    enabled: !!groupId && !!date,
    staleTime: 30_000,
  });
}

export function useMemberCompletion(
  groupId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: ["daily-report-manager", "completion", groupId, date],
    queryFn: () => fetchCompletion(groupId!, date!),
    enabled: !!groupId && !!date,
    staleTime: 30_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateDailyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDailyReportInput) => createDailyReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-report-manager"] });
    },
  });
}

export function useUpdateDailyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<UpdateDailyReportInput, "id"> }) =>
      updateDailyReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-report-manager"] });
    },
  });
}

export function useDeleteDailyReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDailyReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-report-manager"] });
    },
  });
}
