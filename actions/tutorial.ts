"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/permissions";

const nameSchema = z.string().min(1, "Nama kategori wajib diisi").max(100);
const titleSchema = z.string().min(1, "Judul wajib diisi").max(120);
const durationSchema = z.string().max(40);
const captionSchema = z.string().min(1, "Keterangan wajib diisi").max(1000);
const optionalImageSchema = z
  .string()
  .max(255)
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

export async function createTutorialCategory(name: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-category-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = nameSchema.safeParse(name.trim());
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const count = await db.tutorialCategory.count();
    const category = await db.tutorialCategory.create({
      data: {
        name: parsed.data,
        sortOrder: count,
      },
    });
    revalidateTag("tutorials", "max");
    return { success: true, category };
  } catch (e) {
    console.error("[createTutorialCategory]", e);
    return { success: false, error: "Gagal membuat kategori tutorial." };
  }
}

export async function updateTutorialCategory(id: string, name: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-category-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedId = z.string().min(1).safeParse(id);
  if (!parsedId.success) return { success: false, error: "ID kategori tidak valid." };

  const parsedName = nameSchema.safeParse(name.trim());
  if (!parsedName.success) return { success: false, error: parsedName.error.issues[0].message };

  try {
    const category = await db.tutorialCategory.update({
      where: { id: parsedId.data },
      data: { name: parsedName.data },
    });
    revalidateTag("tutorials", "max");
    return { success: true, category };
  } catch (e) {
    console.error("[updateTutorialCategory]", e);
    return { success: false, error: "Gagal memperbarui kategori." };
  }
}

export async function deleteTutorialCategory(id: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-category-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.tutorialCategory.delete({ where: { id } });
    revalidateTag("tutorials", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteTutorialCategory]", e);
    return { success: false, error: "Gagal menghapus kategori." };
  }
}

export async function createTutorialLesson(categoryId: string, title: string, duration: string, completed = false) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-lesson-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedTitle = titleSchema.safeParse(title.trim());
  if (!parsedTitle.success) return { success: false, error: parsedTitle.error.issues[0].message };

  const parsedDuration = durationSchema.safeParse(duration.trim());
  if (!parsedDuration.success) return { success: false, error: parsedDuration.error.issues[0].message };

  try {
    const count = await db.tutorialLesson.count({ where: { categoryId } });
    const lesson = await db.tutorialLesson.create({
      data: {
        categoryId,
        title: parsedTitle.data,
        duration: parsedDuration.data,
        completed,
        sortOrder: count,
      },
    });
    revalidateTag("tutorials", "max");
    return { success: true, lesson };
  } catch (e) {
    console.error("[createTutorialLesson]", e);
    return { success: false, error: "Gagal membuat lesson." };
  }
}

export async function updateTutorialLesson(id: string, title: string, duration: string, completed: boolean) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-lesson-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedTitle = titleSchema.safeParse(title.trim());
  if (!parsedTitle.success) return { success: false, error: parsedTitle.error.issues[0].message };

  const parsedDuration = durationSchema.safeParse(duration.trim());
  if (!parsedDuration.success) return { success: false, error: parsedDuration.error.issues[0].message };

  try {
    const lesson = await db.tutorialLesson.update({
      where: { id },
      data: {
        title: parsedTitle.data,
        duration: parsedDuration.data,
        completed,
      },
    });
    revalidateTag("tutorials", "max");
    return { success: true, lesson };
  } catch (e) {
    console.error("[updateTutorialLesson]", e);
    return { success: false, error: "Gagal memperbarui lesson." };
  }
}

export async function deleteTutorialLesson(id: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-lesson-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.tutorialLesson.delete({ where: { id } });
    revalidateTag("tutorials", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteTutorialLesson]", e);
    return { success: false, error: "Gagal menghapus lesson." };
  }
}

export async function createTutorialStep(lessonId: string, title: string, caption: string, image?: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-step-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedTitle = titleSchema.safeParse(title.trim());
  if (!parsedTitle.success) return { success: false, error: parsedTitle.error.issues[0].message };

  const parsedCaption = captionSchema.safeParse(caption.trim());
  if (!parsedCaption.success) return { success: false, error: parsedCaption.error.issues[0].message };

  const parsedImage = optionalImageSchema.safeParse(image?.trim());
  if (!parsedImage.success) return { success: false, error: parsedImage.error.issues[0].message };

  try {
    const count = await db.tutorialStep.count({ where: { lessonId } });
    const step = await db.tutorialStep.create({
      data: {
        lessonId,
        title: parsedTitle.data,
        caption: parsedCaption.data,
        image: parsedImage.data,
        sortOrder: count,
      },
    });
    revalidateTag("tutorials", "max");
    return { success: true, step };
  } catch (e) {
    console.error("[createTutorialStep]", e);
    return { success: false, error: "Gagal membuat step." };
  }
}

export async function updateTutorialStep(id: string, title: string, caption: string, image?: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-step-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedTitle = titleSchema.safeParse(title.trim());
  if (!parsedTitle.success) return { success: false, error: parsedTitle.error.issues[0].message };

  const parsedCaption = captionSchema.safeParse(caption.trim());
  if (!parsedCaption.success) return { success: false, error: parsedCaption.error.issues[0].message };

  const parsedImage = optionalImageSchema.safeParse(image?.trim());
  if (!parsedImage.success) return { success: false, error: parsedImage.error.issues[0].message };

  try {
    const step = await db.tutorialStep.update({
      where: { id },
      data: {
        title: parsedTitle.data,
        caption: parsedCaption.data,
        image: parsedImage.data,
      },
    });
    revalidateTag("tutorials", "max");
    return { success: true, step };
  } catch (e) {
    console.error("[updateTutorialStep]", e);
    return { success: false, error: "Gagal memperbarui step." };
  }
}

export async function deleteTutorialStep(id: string) {
  const { session, error } = await requirePermission({ module: "settings-tutorial", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`tutorial-step-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.tutorialStep.delete({ where: { id } });
    revalidateTag("tutorials", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteTutorialStep]", e);
    return { success: false, error: "Gagal menghapus step." };
  }
}
