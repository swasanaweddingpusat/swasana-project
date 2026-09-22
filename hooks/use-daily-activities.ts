"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchDailyActivities,
  type FetchDailyActivitiesParams,
} from "@/services/daily-activity-service";
import type { DailyActivitiesResult } from "@/lib/queries/daily-activity";
import {
  createDailyActivity,
  updateDailyActivity,
  deleteDailyActivity,
} from "@/actions/daily-activity";
import type {
  CreateDailyActivityInput,
  UpdateDailyActivityInput,
} from "@/lib/validations/daily-activity";

export function useDailyActivities(
  params: FetchDailyActivitiesParams = {},
  initialData?: DailyActivitiesResult,
) {
  return useQuery<DailyActivitiesResult>({
    queryKey: ["daily-activities", params],
    queryFn: () => fetchDailyActivities(params),
    initialData,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useCreateDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDailyActivityInput) => createDailyActivity(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activities"] }),
  });
}

export function useUpdateDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDailyActivityInput }) =>
      updateDailyActivity(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activities"] }),
  });
}

export function useDeleteDailyActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDailyActivity(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-activities"] }),
  });
}
