import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().min(1, "Nama posisi wajib diisi"),
  departmentId: z.string().optional(),
  level: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

export const updatePositionSchema = createPositionSchema.partial();

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
