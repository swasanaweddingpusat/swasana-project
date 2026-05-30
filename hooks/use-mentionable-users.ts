"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMentionableUsers } from "@/services/mentionable-user-service";
import type { MentionableUser } from "@/lib/queries/users";

export function useMentionableUsers(): {
  users: MentionableUser[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ["mentionable-users"],
    queryFn: fetchMentionableUsers,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  return { users: data ?? [], isLoading };
}
