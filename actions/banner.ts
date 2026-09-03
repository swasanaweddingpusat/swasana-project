"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { BannerLocation, type Banner } from "@prisma/client";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { deleteFromStorage } from "@/lib/storage";

type BannerMutationResult =
  | { success: true; banner: Banner }
  | { success: false; error: string };

type SimpleMutationResult =
  | { success: true }
  | { success: false; error: string };

const bannerSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(150),
  caption: z
    .string()
    .max(500, "Keterangan maksimal 500 karakter")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  imageKey: z.string().min(1, "Gambar wajib diupload"),
  originalName: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  linkUrl: z
    .string()
    .url("URL tidak valid")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  sortOrder: z.number().int().min(0),
  isActive: z.boolean(),
  location: z.nativeEnum(BannerLocation),
});

export type BannerInput = z.infer<typeof bannerSchema>;

const batchItemSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(150),
  caption: z
    .string()
    .max(500, "Keterangan maksimal 500 karakter")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  imageKey: z.string().min(1, "Gambar wajib diupload"),
  originalName: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  linkUrl: z
    .string()
    .url("URL tidak valid")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  sortOrder: z.number().int().min(0),
  location: z.nativeEnum(BannerLocation),
});

const createBannersSchema = z.object({
  items: z.array(batchItemSchema).min(1, "Minimal satu gambar").max(20, "Maksimal 20 gambar sekaligus"),
});

export async function createBanner(data: unknown): Promise<BannerMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-banner", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`banner-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = bannerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const [banner] = await db.$transaction([db.banner.create({ data: parsed.data })]);

    await logAudit({
      userId: session!.user.id,
      action: "banner.create",
      entityType: "Banner",
      entityId: banner.id,
      description: `Created banner "${banner.title}"`,
    });

    revalidateTag("banners", "max");
    return { success: true, banner };
  } catch (e) {
    console.error("[createBanner]", e);
    return { success: false, error: "Gagal membuat banner." };
  }
}

type BannerBatchResult =
  | { success: true; banners: Banner[] }
  | { success: false; error: string };

export async function createBanners(data: unknown): Promise<BannerBatchResult> {
  const { session, error } = await requirePermission({ module: "settings-banner", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`banner-batch:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createBannersSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const banners = await db.$transaction(
      parsed.data.items.map((item) =>
        db.banner.create({
          data: { ...item, isActive: true },
        }),
      ),
    );

    await logAudit({
      userId: session!.user.id,
      action: "banner.create-batch",
      entityType: "Banner",
      entityId: banners.map((b) => b.id).join(","),
      description: `Created ${banners.length} banner(s)`,
    });

    revalidateTag("banners", "max");
    return { success: true, banners };
  } catch (e) {
    console.error("[createBanners]", e);
    return { success: false, error: "Gagal membuat banner." };
  }
}

export async function updateBanner(id: string, data: unknown): Promise<BannerMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-banner", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`banner-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = bannerSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.banner.findUnique({ where: { id }, select: { imageKey: true } });
    if (!existing) return { success: false, error: "Banner tidak ditemukan." };

    const [banner] = await db.$transaction([
      db.banner.update({ where: { id }, data: parsed.data }),
    ]);

    // Best-effort: delete the old image from storage if it was replaced. Never
    // fail the mutation on a storage error.
    if (existing.imageKey && existing.imageKey !== parsed.data.imageKey) {
      await deleteFromStorage(existing.imageKey).catch((e) => {
        console.error("[updateBanner] failed to delete old image", e);
      });
    }

    await logAudit({
      userId: session!.user.id,
      action: "banner.update",
      entityType: "Banner",
      entityId: id,
      description: `Updated banner "${banner.title}"`,
    });

    revalidateTag("banners", "max");
    return { success: true, banner };
  } catch (e) {
    console.error("[updateBanner]", e);
    return { success: false, error: "Gagal memperbarui banner." };
  }
}

export async function deleteBanner(id: string): Promise<SimpleMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-banner", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`banner-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.banner.findUnique({ where: { id }, select: { title: true, imageKey: true } });
    if (!existing) return { success: false, error: "Banner tidak ditemukan." };

    await db.$transaction([db.banner.delete({ where: { id } })]);

    // Best-effort: delete the image from storage. Never fail the mutation on a
    // storage error — the DB row is already gone.
    await deleteFromStorage(existing.imageKey).catch((e) => {
      console.error("[deleteBanner] failed to delete image", e);
    });

    await logAudit({
      userId: session!.user.id,
      action: "banner.delete",
      entityType: "Banner",
      entityId: id,
      description: `Deleted banner "${existing.title}"`,
    });

    revalidateTag("banners", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBanner]", e);
    return { success: false, error: "Gagal menghapus banner." };
  }
}

export async function toggleBannerActive(id: string): Promise<BannerMutationResult> {
  const { session, error } = await requirePermission({ module: "settings-banner", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`banner-toggle:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.banner.findUnique({ where: { id }, select: { isActive: true, title: true } });
    if (!existing) return { success: false, error: "Banner tidak ditemukan." };

    const [banner] = await db.$transaction([
      db.banner.update({ where: { id }, data: { isActive: !existing.isActive } }),
    ]);

    await logAudit({
      userId: session!.user.id,
      action: "banner.toggle-active",
      entityType: "Banner",
      entityId: id,
      description: `${banner.isActive ? "Activated" : "Deactivated"} banner "${banner.title}"`,
    });

    revalidateTag("banners", "max");
    return { success: true, banner };
  } catch (e) {
    console.error("[toggleBannerActive]", e);
    return { success: false, error: "Gagal mengubah status banner." };
  }
}
