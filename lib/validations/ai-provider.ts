import { z } from "zod";

/** Provider AI yang didukung: Anthropic langsung atau gateway 9router. */
export const aiProviderKindSchema = z.enum(["anthropic", "router9"]);

/** Cara kirim credential: header `x-api-key` atau `Authorization: Bearer`. */
export const aiAuthSchemeSchema = z.enum(["api_key", "bearer"]);

const baseFields = {
  name: z.string().trim().min(1, "Nama koneksi wajib diisi").max(100),
  kind: aiProviderKindSchema,
  baseUrl: z
    .string()
    .trim()
    .url("Base URL tidak valid")
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? value : undefined)),
  authScheme: aiAuthSchemeSchema,
  modelId: z.string().trim().min(1, "Model ID wajib diisi").max(120),
  isActive: z.boolean(),
  isDefault: z.boolean(),
};

/** 9router adalah gateway pihak ketiga, jadi base URL-nya wajib diisi sendiri. */
function requireBaseUrlForRouter9(
  data: { kind: z.infer<typeof aiProviderKindSchema>; baseUrl?: string },
  ctx: z.RefinementCtx,
): void {
  if (data.kind === "router9" && !data.baseUrl) {
    ctx.addIssue({
      code: "custom",
      path: ["baseUrl"],
      message: "Base URL wajib diisi untuk koneksi 9router",
    });
  }
}

export const createAiProviderSchema = z
  .object({
    ...baseFields,
    credential: z.string().trim().min(8, "API key / token minimal 8 karakter").max(500),
  })
  .superRefine(requireBaseUrlForRouter9);

export const updateAiProviderSchema = z
  .object({
    ...baseFields,
    id: z.string().min(1),
    // Dikosongkan = pertahankan credential lama (UI tidak pernah menerima nilai asli).
    credential: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .superRefine(requireBaseUrlForRouter9);

export const deleteAiProviderSchema = z.object({ id: z.string().min(1) });

export const testAiProviderSchema = z.object({ id: z.string().min(1) });

export type CreateAiProviderInput = z.infer<typeof createAiProviderSchema>;
export type UpdateAiProviderInput = z.infer<typeof updateAiProviderSchema>;
