import { z } from "zod";

export const dailyReportStatusEnum = z.enum(["ON_TRACK", "OFF_TRACK", "AT_RISK"]);

export const createDailyReportSchema = z.object({
  groupId: z.string().min(1, "Group wajib dipilih"),
  reportDate: z.string().min(1, "Tanggal laporan wajib diisi"),
  totalClientDihubungi: z.coerce.number().int().min(0).default(0),
  totalHotProspect: z.coerce.number().int().min(0).default(0),
  totalLeadsBaru: z.coerce.number().int().min(0).default(0),
  totalFollowUp: z.coerce.number().int().min(0).default(0),
  totalPotensiClosing: z.coerce.number().int().min(0).default(0),
  closingHariIni: z.coerce.number().int().min(0).default(0),
  actionBesok: z.string().trim().max(2000).optional(),
  commitVisit: z.string().trim().max(500).optional(),
  actualVisit: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(1000).optional(),
  kendala: z.string().trim().max(2000).optional(),
  membersCompleted: z.array(z.string()),
  membersTotal: z.coerce.number().int().min(0),
  status: dailyReportStatusEnum,
});

export const updateDailyReportSchema = createDailyReportSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateDailyReportInput = z.infer<typeof createDailyReportSchema>;
export type UpdateDailyReportInput = z.infer<typeof updateDailyReportSchema>;
