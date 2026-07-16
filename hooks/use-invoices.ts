"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { issueInvoiceClient, voidInvoiceClient } from "@/services/invoice-service";
import type { IssueInvoiceInput } from "@/lib/validations/invoice";

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IssueInvoiceInput) => issueInvoiceClient(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ar-bookings"] });
    },
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => voidInvoiceClient(invoiceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ar-bookings"] });
    },
  });
}
