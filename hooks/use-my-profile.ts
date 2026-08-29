"use client";

import { useQuery } from "@tanstack/react-query";

type MyProfile = {
  fullName: string | null;
  department: { id: string; name: string } | null;
  position: { id: string; name: string } | null;
};

async function fetchMyProfile(): Promise<MyProfile> {
  const res = await fetch("/api/me/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<MyProfile>;
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["me-profile"],
    queryFn: fetchMyProfile,
    staleTime: 5 * 60 * 1000,
  });
}
