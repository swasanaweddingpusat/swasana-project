"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UsersQueryResult } from "@/lib/queries/users";
import type { UserFilters } from "@/types/user";
import { inviteUser, updateUser, deleteUser, reactivateUser } from "@/actions/user";
import { fetchUsers, fetchUserById } from "@/services/user-service";

export function useUsers(initialData?: UsersQueryResult, filters: UserFilters = {}) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => fetchUsers(filters),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchUserById(id),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!id,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => inviteUser(formData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateUser(data),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }
    },
  });
}
