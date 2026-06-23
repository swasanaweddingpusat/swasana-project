import { z } from "zod";

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1, "Nama jenis cuti wajib diisi"),
  code: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, "Code harus lowercase alphanumeric"),
  description: z.string().optional(),
  defaultQuota: z.number().int().min(0).default(0),
  isDeductible: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  maxConsecutiveDays: z.number().int().min(1).optional(),
  minDaysBeforeRequest: z.number().int().min(0).default(0),
  isCarryOver: z.boolean().default(false),
  carryOverMaxDays: z.number().int().min(1).optional(),
  carryOverExpiryMonths: z.number().int().min(1).max(12).optional(),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;
