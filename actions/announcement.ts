"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  addAnnouncementCommentSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "@/lib/validations/announcement";

async function generateNoAnnouncement(): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const count = await db.announcement.count({
    where: {
      createdAt: { gte: startOfYear, lt: endOfYear },
    },
  });

  const seq = (count + 1).toString().padStart(3, "0");
  return `ANN/${year}/${seq}`;
}

export async function createAnnouncement(
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-create:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = createAnnouncementSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const noAnnouncement = await generateNoAnnouncement();

  try {
    const [announcement] = await db.$transaction([
      db.announcement.create({
        data: {
          ...parsed.data,
          createdById: session!.user.profileId,
          publishedAt: parsed.data.status === "published" ? new Date() : null,
        },
        select: { id: true, title: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "announcement.create",
      entityType: "Announcement",
      entityId: announcement.id,
      description: `Created announcement "${noAnnouncement}" — ${announcement.title}`,
    });

    revalidateTag("announcements", "max");
    return { success: true };
  } catch (e) {
    console.error("[createAnnouncement]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateAnnouncement(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-update:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = updateAnnouncementSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.announcement.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) return { success: false, error: "Pengumuman tidak ditemukan." };

    await db.$transaction([
      db.announcement.update({
        where: { id },
        data: parsed.data,
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "announcement.update",
      entityType: "Announcement",
      entityId: id,
      description: `Updated announcement "${existing.title}"`,
    });

    revalidateTag("announcements", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateAnnouncement]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteAnnouncement(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-delete:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const existing = await db.announcement.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) return { success: false, error: "Pengumuman tidak ditemukan." };

    await db.$transaction([db.announcement.delete({ where: { id } })]);

    await logAudit({
      userId: session!.user.profileId,
      action: "announcement.delete",
      entityType: "Announcement",
      entityId: id,
      description: `Deleted announcement "${existing.title}"`,
    });

    revalidateTag("announcements", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteAnnouncement]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function addAnnouncementComment(
  announcementId: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-comment:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  const parsed = addAnnouncementCommentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const announcement = await db.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true },
    });
    if (!announcement) return { success: false, error: "Pengumuman tidak ditemukan." };

    const [comment] = await db.$transaction([
      db.announcementComment.create({
        data: {
          announcementId,
          authorId: session!.user.profileId,
          content: parsed.data.content,
        },
        select: { id: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "announcement.comment",
      entityType: "AnnouncementComment",
      entityId: comment.id,
      description: `Added comment to announcement ${announcementId}`,
    });

    revalidateTag("announcements", "max");
    return { success: true };
  } catch (e) {
    console.error("[addAnnouncementComment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function markAnnouncementAsRead(
  announcementId: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-read:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.announcementReader.create({
        data: {
          announcementId,
          readerId: session!.user.profileId,
        },
      }),
    ]);

    revalidateTag("announcements", "max");
    return { success: true };
  } catch {
    // Already marked as read — ignore duplicate constraint error
    return { success: true };
  }
}

export async function publishAnnouncement(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "announcement", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`announcement-publish:${session!.user.id}`))
    return { success: false, ...rateLimitError() };

  try {
    const existing = await db.announcement.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) return { success: false, error: "Pengumuman tidak ditemukan." };

    await db.$transaction([
      db.announcement.update({
        where: { id },
        data: { status: "published", publishedAt: new Date() },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "announcement.publish",
      entityType: "Announcement",
      entityId: id,
      description: `Published announcement "${existing.title}"`,
    });

    revalidateTag("announcements", "max");
    return { success: true };
  } catch (e) {
    console.error("[publishAnnouncement]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
