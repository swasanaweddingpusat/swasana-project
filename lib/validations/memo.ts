import { z } from "zod";

export const createMemoSchema = z.object({
  ruangLingkup: z.string().optional().nullable(),
  judul: z.string().min(1, "Judul wajib diisi"),
  kepada: z.string().optional().nullable(),
  tembusan: z.string().optional().nullable(),
  perihal: z.string().optional().nullable(),
  jenisInformasi: z.string().optional().nullable(),
  klasifikasi: z.string().optional().nullable(),
  yangMenyetujui: z.string().optional().nullable(),
  yangMengetahui: z.string().optional().nullable(),
  isiMemo: z.string().optional().nullable(),
  venueId: z.string().optional().nullable(),
  status: z.enum(["draft", "review", "published"]).default("draft"),
});

export type CreateMemoInput = z.infer<typeof createMemoSchema>;

export const updateMemoSchema = createMemoSchema.partial();
export type UpdateMemoInput = z.infer<typeof updateMemoSchema>;

export const addMemoCommentSchema = z.object({
  content: z.string().min(1, "Komentar tidak boleh kosong"),
});

export type AddMemoCommentInput = z.infer<typeof addMemoCommentSchema>;
