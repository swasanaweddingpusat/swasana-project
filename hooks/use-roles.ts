"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RolesQueryResult } from "@/lib/queries/roles";
import { createRole, updateRole, deleteRole, updateRolePermissions, reorderRoles, createPermission, deletePermission, deleteModulePermissions, updatePermission, reorderModules, renameModule } from "@/actions/role";
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

export function useReorderRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderRoles(orderedIds),
    onMutate: async (orderedIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["roles"] });
      const previous = queryClient.getQueryData<RolesQueryResult>(["roles"]);
      if (previous) {
        const reordered = orderedIds
          .map((id, idx) => {
            const role = previous.find((r) => r.id === id);
            return role ? { ...role, sortOrder: idx } : null;
          })
          .filter(Boolean) as RolesQueryResult;
        queryClient.setQueryData(["roles"], reordered);
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(["roles"], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ module, action }: { module: string; action: string }) => createPermission(module, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (permissionId: string) => deletePermission(permissionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useDeleteModulePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (module: string) => deleteModulePermissions(module),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ permissionId, action }: { permissionId: string; action: string }) =>
      updatePermission(permissionId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useReorderModules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleOrder: string[]) => reorderModules(moduleOrder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}

export function useRenameModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ oldModule, newModule }: { oldModule: string; newModule: string }) =>
      renameModule(oldModule, newModule),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roles"] }),
  });
}
