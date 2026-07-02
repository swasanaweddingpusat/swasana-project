import { z } from "zod";

export const generateBalancesSchema = z.object({
  year: z.number().int().min(2020).max(2100),
});

export const adjustBalanceSchema = z.object({
  balanceId: z.string().min(1),
  adjustmentDays: z.number().int(),
  reason: z.string().min(1, "Alasan adjustment wajib diisi"),
});

export type GenerateBalancesInput = z.infer<typeof generateBalancesSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
