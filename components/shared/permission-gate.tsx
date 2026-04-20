"use client";

import { usePermissions } from "@/hooks/use-permissions";
import type { ReactNode } from "react";

interface PermissionGateProps {
  module: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  module,
  action,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, isLoading } = usePermissions();

  if (isLoading) return null;
  if (!can(module, action)) return <>{fallback}</>;

  return <>{children}</>;
}
