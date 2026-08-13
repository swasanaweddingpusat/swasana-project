import { z } from "zod";

// Module `key` becomes the URL segment (/finance, /hrd, …) so it must be a
// clean kebab/lower slug — letters, digits and single dashes only.
const moduleKey = z
  .string()
  .trim()
  .min(2, "Key minimal 2 karakter")
  .max(40, "Key maksimal 40 karakter")
  .regex(/^[a-z][a-z0-9-]*$/, "Key hanya boleh huruf kecil, angka, dan tanda hubung");

export const createModuleSchema = z.object({
  key: moduleKey,
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60, "Nama maksimal 60 karakter"),
  icon: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean().default(true),
  permissionModules: z.array(z.string().trim().min(1)).default([]),
});

export const updateModuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(60, "Nama maksimal 60 karakter"),
  icon: z.string().trim().min(1).max(60).optional(),
  isActive: z.boolean(),
  permissionModules: z.array(z.string().trim().min(1)).default([]),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
