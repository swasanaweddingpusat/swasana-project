"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ModuleAdminItem } from "@/lib/queries/modules";
import {
  createModule,
  updateModule,
  deleteModule,
  reorderModuleRegistry,
} from "@/actions/modules";
import type { CreateModuleInput, UpdateModuleInput } from "@/lib/validations/module";

async function fetchAllModules(): Promise<ModuleAdminItem[]> {
  const res = await fetch("/api/modules/all");
  if (!res.ok) throw new Error("Failed to load modules");
  return res.json();
}

/**
 * Full module registry for the admin page. Seeded from the server component so
 * the first paint is instant; refetched on invalidation after a mutation.
 */
export function useModuleAdmin(initial: ModuleAdminItem[]) {
  return useQuery({
    queryKey: ["module-admin"],
    queryFn: fetchAllModules,
    initialData: initial,
    staleTime: 30 * 1000,
  });
}

// After any registry change, invalidate BOTH the admin list and the sidebar
// switcher's ["modules"] cache so the switcher reflects the edit immediately.
function useModuleInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["module-admin"] });
    void qc.invalidateQueries({ queryKey: ["modules"] });
  };
}

export function useCreateModule() {
  const invalidate = useModuleInvalidate();
  return useMutation({
    mutationFn: (input: CreateModuleInput) => createModule(input),
    onSuccess: invalidate,
  });
}

export function useUpdateModule() {
  const invalidate = useModuleInvalidate();
  return useMutation({
    mutationFn: (input: UpdateModuleInput) => updateModule(input),
    onSuccess: invalidate,
  });
}

export function useDeleteModule() {
  const invalidate = useModuleInvalidate();
  return useMutation({
    mutationFn: (id: string) => deleteModule(id),
    onSuccess: invalidate,
  });
}

export function useReorderModuleRegistry() {
  const invalidate = useModuleInvalidate();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderModuleRegistry(orderedIds),
    onSuccess: invalidate,
  });
}
