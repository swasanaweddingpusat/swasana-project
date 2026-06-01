"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAssignableSalesUsers } from "@/services/sales-user-service";
import type { AssignableSalesUser } from "@/lib/queries/users";

export function useSalesUsers(): {
  users: AssignableSalesUser[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["sales-users"],
    queryFn: fetchAssignableSalesUsers,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { users: data ?? [], isLoading };
}
