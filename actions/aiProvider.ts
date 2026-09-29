"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import {
  createAiProviderSchema,
  deleteAiProviderSchema,
  testAiProviderSchema,
  updateAiProviderSchema,
} from "@/lib/validations/ai-provider";
import { createModelRuntimeForConfig } from "@/lib/ai/pi-session";

type MutationResult = { success: true } | { success: false; error: string };

/** Hanya boleh ada satu koneksi default — dipakai Chat AI saat user belum memilih model. */
function clearOtherDefaults(exceptId?: string) {
  return db.aiProviderConfig.updateMany({
    where: exceptId ? { id: { not: exceptId } } : {},
    data: { isDefault: false },
  });
}

export async function createAiProvider(input: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-ai-model", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ai-provider-create:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = createAiProviderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { credential, ...rest } = parsed.data;

  try {
    const created = await db.aiProviderConfig.create({
      data: { ...rest, baseUrl: rest.baseUrl ?? null, credentialEnc: encryptSecret(credential) },
      select: { id: true, name: true },
    });

    if (rest.isDefault) await clearOtherDefaults(created.id);

    await logAudit({
      userId: session!.user.id,
      action: "ai-provider.create",
      entityType: "AiProviderConfig",
      entityId: created.id,
      description: `Menambah koneksi AI "${created.name}"`,
    });

    revalidateTag("ai-providers", "max");
    return { success: true };
  } catch (e) {
    console.error("[createAiProvider]", e);
    return { success: false, error: "Gagal menyimpan koneksi AI. Pastikan nama belum dipakai." };
  }
}

export async function updateAiProvider(input: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-ai-model", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ai-provider-update:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = updateAiProviderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, credential, ...rest } = parsed.data;

  try {
    const existing = await db.aiProviderConfig.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return { success: false, error: "Koneksi AI tidak ditemukan." };

    await db.aiProviderConfig.update({
      where: { id },
      data: {
        ...rest,
        baseUrl: rest.baseUrl ?? null,
        // Credential hanya ditimpa kalau user benar-benar mengisi nilai baru.
        ...(credential ? { credentialEnc: encryptSecret(credential) } : {}),
        ...(credential ? { lastTestedAt: null, lastTestOk: null } : {}),
      },
    });

    if (rest.isDefault) await clearOtherDefaults(id);

    await logAudit({
      userId: session!.user.id,
      action: "ai-provider.update",
      entityType: "AiProviderConfig",
      entityId: id,
      description: `Memperbarui koneksi AI "${rest.name}"${credential ? " (credential diganti)" : ""}`,
    });

    revalidateTag("ai-providers", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateAiProvider]", e);
    return { success: false, error: "Gagal memperbarui koneksi AI." };
  }
}

export async function deleteAiProvider(input: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-ai-model", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ai-provider-delete:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = deleteAiProviderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.aiProviderConfig.findUnique({
      where: { id: parsed.data.id },
      select: { name: true },
    });
    if (!existing) return { success: false, error: "Koneksi AI tidak ditemukan." };

    await db.$transaction([db.aiProviderConfig.delete({ where: { id: parsed.data.id } })]);

    await logAudit({
      userId: session!.user.id,
      action: "ai-provider.delete",
      entityType: "AiProviderConfig",
      entityId: parsed.data.id,
      description: `Menghapus koneksi AI "${existing.name}"`,
    });

    revalidateTag("ai-providers", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteAiProvider]", e);
    return { success: false, error: "Gagal menghapus koneksi AI." };
  }
}

/** Uji koneksi: resolve credential + pastikan model benar-benar tersedia. */
export async function testAiProvider(input: unknown): Promise<MutationResult> {
  const { session, error } = await requirePermission({ module: "settings-ai-model", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`ai-provider-test:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = testAiProviderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const config = await db.aiProviderConfig.findUnique({ where: { id: parsed.data.id } });
  if (!config) return { success: false, error: "Koneksi AI tidak ditemukan." };

  try {
    const { runtime, providerId } = await createModelRuntimeForConfig(config);
    const model = runtime.getModel(providerId, config.modelId);
    if (!model) throw new Error(`Model "${config.modelId}" tidak ditemukan pada koneksi ini.`);

    await db.aiProviderConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: new Date(), lastTestOk: true },
    });
    revalidateTag("ai-providers", "max");
    return { success: true };
  } catch (e) {
    console.error("[testAiProvider]", e);
    await db.aiProviderConfig.update({
      where: { id: config.id },
      data: { lastTestedAt: new Date(), lastTestOk: false },
    });
    revalidateTag("ai-providers", "max");
    return {
      success: false,
      error: e instanceof Error ? e.message : "Koneksi gagal diuji.",
    };
  }
}
