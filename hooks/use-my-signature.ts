"use client";

import { useQuery } from "@tanstack/react-query";

interface MySignatureResponse {
  defaultSignature: string | null;
}

async function fetchMySignature(): Promise<MySignatureResponse> {
  const res = await fetch("/api/me/signature");
  if (!res.ok) throw new Error("Failed to fetch signature");
  return res.json() as Promise<MySignatureResponse>;
}

export function useMySignature() {
  const { data, isLoading } = useQuery({
    queryKey: ["me-signature"],
    queryFn: fetchMySignature,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  return {
    defaultSignature: data?.defaultSignature ?? null,
    isLoading,
  };
}
