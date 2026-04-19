"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UsersQueryResult } from "@/lib/queries/users";
import type { UserFilters } from "@/types/user";
import { inviteUser, updateUser, deleteUser } from "@/actions/user";
import { fetchUsers, fetchUserById } from "@/services/user-service";

export function useUsers(filters: UserFilters = {}, initialData?: UsersQueryResult) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: () => fetchUsers(filters),
    initialData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => fetchUserById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => inviteUser(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
