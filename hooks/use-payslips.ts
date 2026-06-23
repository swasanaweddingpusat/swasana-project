"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMyPayslips, fetchPayslipById } from "@/services/payslip-service";

export function useMyPayslips() {
  return useQuery({
    queryKey: ["my-payslips"],
    queryFn: fetchMyPayslips,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePayslipDetail(id: string) {
  return useQuery({
    queryKey: ["payslip", id],
    queryFn: () => fetchPayslipById(id),
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  });
}
