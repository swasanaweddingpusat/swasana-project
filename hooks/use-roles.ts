"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RolesQueryResult } from "@/lib/queries/roles";
import { createRole, updateRole, deleteRole, updateRolePermissions } from "@/actions/role";
import { fetchRoles } from "@/services/role-service";

export function useRoles(initialData?: RolesQueryResult) {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => fetchRoles(),
    initialData,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => createRole(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => updateRole(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteRole(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

export function useUpdateRolePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      updateRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}
