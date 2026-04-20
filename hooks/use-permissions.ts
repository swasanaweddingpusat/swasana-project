"use client";

import { useQuery } from "@tanstack/react-query";
import type { PermissionMatrix } from "@/types/user";

interface PermissionsResponse {
  isAdmin: boolean;
  permissions: PermissionMatrix;
}

async function fetchPermissions(): Promise<PermissionsResponse> {
  const res = await fetch("/api/me/permissions");
  if (!res.ok) throw new Error("Failed to fetch permissions");
  return res.json();
}

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["me:permissions"],
    queryFn: fetchPermissions,
    staleTime: 5 * 60 * 1000,
  });

  const can = (module: string, action: string): boolean => {
    if (!data) return false;
    if (data.isAdmin) return true;
    return data.permissions?.[module]?.[action] === true;
  };

  return {
    isLoading,
    isAdmin: data?.isAdmin ?? false,
    can,
    canView: (module: string) => can(module, "view"),
    canCreate: (module: string) => can(module, "create"),
    canEdit: (module: string) => can(module, "update"),
    canDelete: (module: string) => can(module, "delete"),
  };
}
