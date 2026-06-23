import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Nama departemen wajib diisi"),
  description: z.string().optional(),
  parentId: z.string().optional(),
  headId: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
