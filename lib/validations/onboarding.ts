import { z } from "zod";

export const createOnboardingTemplateSchema = z.object({
  name: z.string().min(1, "Nama template wajib diisi"),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const updateOnboardingTemplateSchema = createOnboardingTemplateSchema.partial();

export const addOnboardingTemplateTaskSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1, "Judul task wajib diisi"),
  description: z.string().optional(),
  dueInDays: z.number().int().min(1).default(1),
  assignTo: z.enum(["employee", "hr", "manager"]).default("employee"),
  sortOrder: z.number().int().default(0),
});

export const updateOnboardingTemplateTaskSchema = addOnboardingTemplateTaskSchema
  .omit({ templateId: true })
  .partial();

export const assignOnboardingSchema = z.object({
  profileId: z.string().min(1, "Karyawan wajib dipilih"),
  templateId: z.string().min(1, "Template wajib dipilih"),
});

export type CreateOnboardingTemplateInput = z.infer<typeof createOnboardingTemplateSchema>;
export type UpdateOnboardingTemplateInput = z.infer<typeof updateOnboardingTemplateSchema>;
export type AddOnboardingTemplateTaskInput = z.infer<typeof addOnboardingTemplateTaskSchema>;
export type UpdateOnboardingTemplateTaskInput = z.infer<typeof updateOnboardingTemplateTaskSchema>;
export type AssignOnboardingInput = z.infer<typeof assignOnboardingSchema>;
