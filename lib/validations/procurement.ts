import { z } from "zod";

// ─── Procurement Item CRUD ────────────────────────────────────────────────────

export const createProcurementSchema = z.object({
  tanggalPermintaan: z.string().min(1, "Tanggal permintaan wajib diisi"),
  venueId: z.string().min(1, "Venue wajib dipilih"),
  namaBarang: z.string().trim().min(1, "Nama barang wajib diisi"),
  jumlahBarang: z.number().int().min(1, "Jumlah minimal 1"),
  sisaBarang: z.number().int().min(0, "Sisa tidak boleh negatif"),
  penggunaan: z.string().optional().nullable(),
  picPenerima: z.string().trim().min(1, "PIC penerima wajib diisi"),
  linkBarang: z.string().url("Format URL tidak valid").optional().or(z.literal("")).or(z.null()),
  note: z.string().optional().nullable(),
  keterangan: z.string().optional().nullable(),
  keteranganAcara: z.enum(["WEDDING", "NON_WEDDING"]),
  weddingNote: z.string().optional().nullable(),
  nonWeddingNote: z.string().optional().nullable(),
  totalWedding: z.number().min(0).optional().nullable(),
  totalNonWedding: z.number().min(0).optional().nullable(),
  total: z.number().min(0).optional().nullable(),
  division: z.enum(["HR", "OPERATIONAL", "IT", "FINANCE", "MICE"]).optional().nullable(),
  buktiBelUrl: z.string().optional().nullable(),
});

export const updateProcurementSchema = createProcurementSchema.partial();

// ─── Approval ─────────────────────────────────────────────────────────────────

export const approveProcurementSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "COMPLETE"]),
    keterangan: z.string().optional(),
  })
  .refine(
    (data) =>
      data.action !== "REJECT" ||
      (data.keterangan !== undefined && data.keterangan.trim().length > 0),
    { message: "Keterangan wajib diisi saat menolak", path: ["keterangan"] }
  );

// ─── Procurement Filters ──────────────────────────────────────────────────────

export const procurementFilterSchema = z.object({
  venueId: z.string().optional(),
  division: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Announcements ────────────────────────────────────────────────────────────

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Judul wajib diisi"),
  content: z.string().trim().min(1, "Isi pengumuman wajib diisi"),
  isActive: z.boolean().default(true),
  targetAudience: z.enum(["ALL", "VENUE", "DIVISION"]).default("ALL"),
  targetList: z.array(z.string()).default([]),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateProcurementInput = z.infer<typeof createProcurementSchema>;
export type UpdateProcurementInput = z.infer<typeof updateProcurementSchema>;
export type ApproveProcurementInput = z.infer<typeof approveProcurementSchema>;
export type ProcurementFilterInput = z.infer<typeof procurementFilterSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
