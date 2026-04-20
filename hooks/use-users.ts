"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UsersQueryResult } from "@/lib/queries/users";
import { inviteUser, updateUser, deleteUser } from "@/actions/user";
import { fetchUsers, fetchUserById } from "@/services/user-service";

export function useUsers(initialData?: UsersQueryResult) {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    initialData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
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
