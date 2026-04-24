"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { deleteFromR2 } from "@/lib/r2";

const contentSchema = z.string().max(2000);

export interface CommentAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

export async function createBookingComment(data: {
  bookingId: string;
  content: string;
  mentions: string[];
  replyToId?: string;
  attachments?: CommentAttachment[];
}) {
  const { session, error } = await requirePermission({ module: "booking", action: "view" });
  if (error) return { success: false as const, error };

  const parsed = contentSchema.safeParse(data.content);
  if (!parsed.success) return { success: false as const, error: "Komentar tidak valid." };
  if (!data.content.trim() && !data.attachments?.length) return { success: false as const, error: "Komentar tidak boleh kosong." };

  try {
    const comment = await db.bookingComment.create({
      data: {
        bookingId: data.bookingId,
        authorId: session!.user.profileId,
        content: parsed.data.trim(),
        mentions: data.mentions,
        replyToId: data.replyToId ?? null,
        attachments: (data.attachments ?? []) as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        replyTo: { select: { id: true, content: true, author: { select: { fullName: true } } } },
      },
    });

    // Notify mentioned users + booking sales/manager (exclude author)
    const booking = await db.booking.findUnique({
      where: { id: data.bookingId },
      select: { salesId: true, managerId: true, snapCustomer: { select: { name: true } } },
    });

    if (booking) {
      const notifyIds = new Set<string>([
        ...data.mentions,
        booking.salesId,
        ...(booking.managerId ? [booking.managerId] : []),
      ]);
      notifyIds.delete(session!.user.profileId);

      if (notifyIds.size > 0) {
        await db.notification.createMany({
          data: [...notifyIds].map((profileId) => ({
            userId: profileId,
            title: "Komentar baru",
            message: `${session!.user.name} berkomentar di booking ${booking.snapCustomer?.name ?? ""}`,
            type: "comment",
            entityType: "booking",
            entityId: data.bookingId,
          })),
          skipDuplicates: true,
        });
      }
    }

    revalidateTag(`booking-comments-${data.bookingId}`, "max");
    return { success: true as const, comment };
  } catch (e) {
    console.error("[createBookingComment]", e);
    return { success: false as const, error: "Gagal mengirim komentar." };
  }
}

export async function editBookingComment(id: string, content: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "view" });
  if (error) return { success: false as const, error };

  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { success: false as const, error: "Komentar tidak valid." };

  try {
    const existing = await db.bookingComment.findUnique({ where: { id }, select: { authorId: true, bookingId: true } });
    if (!existing) return { success: false as const, error: "Komentar tidak ditemukan." };
    if (existing.authorId !== session!.user.profileId) return { success: false as const, error: "Tidak diizinkan." };

    const comment = await db.bookingComment.update({
      where: { id },
      data: { content: parsed.data.trim(), edited: true },
    });

    revalidateTag(`booking-comments-${existing.bookingId}`, "max");
    return { success: true as const, comment };
  } catch (e) {
    console.error("[editBookingComment]", e);
    return { success: false as const, error: "Gagal mengedit komentar." };
  }
}

export async function deleteBookingComment(id: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "view" });
  if (error) return { success: false as const, error };

  try {
    const existing = await db.bookingComment.findUnique({
      where: { id },
      select: { authorId: true, bookingId: true, attachments: true },
    });
    if (!existing) return { success: false as const, error: "Komentar tidak ditemukan." };
    if (existing.authorId !== session!.user.profileId) return { success: false as const, error: "Tidak diizinkan." };

    await db.bookingComment.delete({ where: { id } });

    // Delete attachments from R2
    if (Array.isArray(existing.attachments) && existing.attachments.length > 0) {
      const atts = existing.attachments as { path: string }[];
      await Promise.all(atts.map((a) => deleteFromR2(a.path).catch((e) => console.error("[deleteBookingComment] R2:", e))));
    }

    revalidateTag(`booking-comments-${existing.bookingId}`, "max");
    return { success: true as const };
  } catch (e) {
    console.error("[deleteBookingComment]", e);
    return { success: false as const, error: "Gagal menghapus komentar." };
  }
}

export async function markCommentsRead(bookingId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "view" });
  if (error) return;

  try {
    await db.bookingCommentRead.upsert({
      where: { profileId_bookingId: { profileId: session!.user.profileId, bookingId } },
      create: { profileId: session!.user.profileId, bookingId },
      update: { lastReadAt: new Date() },
    });
  } catch (e) {
    console.error("[markCommentsRead]", e);
  }
}
