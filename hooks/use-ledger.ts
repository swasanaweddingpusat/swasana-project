"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setLedgerShowInPo, setAllocationShowInPo } from "@/actions/ledger";

/**
 * Toggle flag `showInPo` satu cash-in dari editor booking (Sales, `booking:edit`)
 * maupun Finance AR (`finance-ar:edit`). Persist langsung — PO update tanpa nunggu
 * Simpan. Dipakai di edit-top-drawer (inline payment + kartu termin terkunci).
 */
export function useToggleCashInShowInPo(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ledgerId: string; showInPo: boolean }) =>
      setLedgerShowInPo({ ledgerId: input.ledgerId, value: input.showInPo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
      void qc.invalidateQueries({ queryKey: ["ar-bookings"] });
    },
  });
}

/**
 * Toggle flag `showInPo` satu PaymentAllocation (per termin) — sumber kebenaran
 * render PO sekarang per-alokasi (getPoPayments). Persist langsung, sama seperti
 * toggle level-cash-in. Dipakai di kartu pembayaran tercatat (EditPaymentStep).
 */
export function useToggleAllocationShowInPo(bookingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { allocationId: string; showInPo: boolean }) =>
      setAllocationShowInPo({ allocationId: input.allocationId, value: input.showInPo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["booking-finance-detail", bookingId] });
      void qc.invalidateQueries({ queryKey: ["ar-bookings"] });
    },
  });
}
