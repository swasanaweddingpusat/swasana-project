"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export function useCurrentUser() {
  const { data: session, status } = useSession();

  const query = useQuery({
    queryKey: ["current-user", session?.user?.id],
    queryFn: async () => session?.user ?? null,
    enabled: status === "authenticated",
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}
