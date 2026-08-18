import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi"),
  category: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  priority: z.enum(["high", "normal"]).default("normal"),
  targetAudience: z.string().optional().nullable(),
  status: z.enum(["draft", "published"]).default("draft"),
  venueId: z.string().optional().nullable(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

export const updateAnnouncementSchema = createAnnouncementSchema.partial();
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

export const addAnnouncementCommentSchema = z.object({
  content: z.string().min(1, "Komentar tidak boleh kosong"),
});
export type AddAnnouncementCommentInput = z.infer<typeof addAnnouncementCommentSchema>;
