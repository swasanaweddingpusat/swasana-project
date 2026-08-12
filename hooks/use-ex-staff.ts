"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchExStaff } from "@/services/exStaffService";

export function useExStaff() {
  return useQuery({
    queryKey: ["ex-staff"],
    queryFn: fetchExStaff,
    staleTime: 5 * 60 * 1000,
  });
}
