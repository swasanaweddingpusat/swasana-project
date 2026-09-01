"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { deleteFromStorage, resolveAvatarUrl } from "@/lib/storage";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { canAccessBooking } from "@/lib/access-control";
import { createNotifications } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";

const contentSchema = z.string().max(2000);
const emojiSchema = z.string().min(1).max(16);

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
  const { session, error } = await requirePermission({ module: "booking", action: "comment" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`comment-create:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = contentSchema.safeParse(data.content);
  if (!parsed.success) return { success: false as const, error: "Komentar tidak valid." };
  if (!data.content.trim() && !data.attachments?.length) return { success: false as const, error: "Komentar tidak boleh kosong." };

  if (!session!.user.profileId) return { success: false as const, error: "Sesi tidak valid, silakan login ulang." };
  const scope = session!.user.dataScope;
  if (!(await canAccessBooking(session!.user.profileId, scope, data.bookingId))) {
    return { success: false as const, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    const [comment] = await db.$transaction([db.bookingComment.create({
      data: {
        bookingId: data.bookingId,
        authorId: session!.user.profileId,
        content: parsed.data.trim(),
        mentions: data.mentions,
        replyToId: data.replyToId ?? null,
        attachments: (data.attachments ?? []) as never,
      },
      include: {
        author: { select: { id: true, fullName: true, avatarUrl: true } },
        replyTo: { select: { id: true, content: true, author: { select: { fullName: true } } } },
      },
    })]);

    revalidateTag(`booking-comments-${data.bookingId}`, "max");

    // Send mention notifications (non-blocking)
    const authorProfileId = session!.user.profileId;
    const authorName = comment.author.fullName ?? "Seseorang";
    const uniqueMentions = [...new Set(data.mentions)].filter((id) => id !== authorProfileId);
    if (uniqueMentions.length > 0) {
      const contentPreview = parsed.data.trim().slice(0, 80);
      void createNotifications(
        uniqueMentions.map((profileId) => ({
          userId: profileId,
          type: "comment_mention",
          title: "Kamu disebut di komentar",
          message: `${authorName} menyebut kamu: "${contentPreview}${parsed.data.trim().length > 80 ? "..." : ""}"`,
          entityType: "booking",
          entityId: data.bookingId,
          isMention: true,
          commentId: comment.id,
        }))
      );
    }

    const resolvedComment = {
      ...comment,
      author: { ...comment.author, avatarUrl: resolveAvatarUrl(comment.author.avatarUrl) },
    };
    return { success: true as const, comment: resolvedComment };
  } catch (e) {
    console.error("[createBookingComment]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function editBookingComment(id: string, content: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "comment" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`comment-edit:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  const parsed = contentSchema.safeParse(content);
  if (!parsed.success) return { success: false as const, error: "Komentar tidak valid." };

  try {
    const existing = await db.bookingComment.findUnique({ where: { id }, select: { authorId: true, bookingId: true } });
    if (!existing) return { success: false as const, error: "Komentar tidak ditemukan." };
    if (existing.authorId !== session!.user.profileId) return { success: false as const, error: "Tidak diizinkan." };

    const [comment] = await db.$transaction([db.bookingComment.update({
      where: { id },
      data: { content: parsed.data.trim(), edited: true },
    })]);

    revalidateTag(`booking-comments-${existing.bookingId}`, "max");

    await logAudit({
      userId: session!.user.profileId,
      action: "booking.comment_edited",
      entityType: "booking",
      entityId: existing.bookingId,
      description: `Mengubah komentar`,
    });

    return { success: true as const, comment };
  } catch (e) {
    console.error("[editBookingComment]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function deleteBookingComment(id: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "comment" });
  if (error) return { success: false as const, error };
  if (!mutationLimiter.check(`comment-delete:${session!.user.id}`)) return { success: false as const, ...rateLimitError() };

  try {
    const existing = await db.bookingComment.findUnique({
      where: { id },
      select: { authorId: true, bookingId: true, attachments: true },
    });
    if (!existing) return { success: false as const, error: "Komentar tidak ditemukan." };
    if (existing.authorId !== session!.user.profileId) return { success: false as const, error: "Tidak diizinkan." };

    await db.$transaction([db.bookingComment.delete({ where: { id } })]);

    // Delete attachments from storage
    if (Array.isArray(existing.attachments) && existing.attachments.length > 0) {
      const atts = existing.attachments as { path: string }[];
      await Promise.all(atts.map((a) => deleteFromStorage(a.path).catch((e) => console.error("[deleteBookingComment] storage:", e))));
    }

    revalidateTag(`booking-comments-${existing.bookingId}`, "max");

    await logAudit({
      userId: session!.user.profileId,
      action: "booking.comment_deleted",
      entityType: "booking",
      entityId: existing.bookingId,
      description: `Menghapus komentar`,
    });

    return { success: true as const };
  } catch (e) {
    console.error("[deleteBookingComment]", e);
    return { success: false as const, error: "Terjadi kesalahan." };
  }
}

export async function toggleCommentReaction(
  commentId: string,
  emoji: string
): Promise<{ success: true; added: boolean } | { success: false; error: string }> {
  const { session, error } = await requirePermission({ module: "booking", action: "comment" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`comment-react:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsedEmoji = emojiSchema.safeParse(emoji);
  if (!parsedEmoji.success) return { success: false, error: "Emoji tidak valid." };

  if (!session!.user.profileId) return { success: false, error: "Sesi tidak valid, silakan login ulang." };
  const profileId = session!.user.profileId;

  try {
    const comment = await db.bookingComment.findUnique({
      where: { id: commentId },
      select: { bookingId: true },
    });
    if (!comment) return { success: false, error: "Komentar tidak ditemukan." };

    const scope = session!.user.dataScope;
    if (!(await canAccessBooking(profileId, scope, comment.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    const existing = await db.bookingCommentReaction.findUnique({
      where: { commentId_profileId_emoji: { commentId, profileId, emoji: parsedEmoji.data } },
      select: { id: true },
    });

    if (existing) {
      await db.$transaction([
        db.bookingCommentReaction.delete({ where: { id: existing.id } }),
      ]);
      revalidateTag(`booking-comments-${comment.bookingId}`, "max");
      return { success: true, added: false };
    } else {
      await db.$transaction([
        db.bookingCommentReaction.create({
          data: { commentId, profileId, emoji: parsedEmoji.data },
        }),
      ]);
      revalidateTag(`booking-comments-${comment.bookingId}`, "max");
      return { success: true, added: true };
    }
  } catch (e) {
    console.error("[toggleCommentReaction]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function markCommentsRead(bookingId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "comment" });
  if (error) return;
  if (!mutationLimiter.check(`comments-read:${session!.user.id}`)) return;

  try {
    await db.$transaction([db.bookingCommentRead.upsert({
      where: { profileId_bookingId: { profileId: session!.user.profileId, bookingId } },
      create: { profileId: session!.user.profileId, bookingId },
      update: { lastReadAt: new Date() },
    })]);
  } catch (e) {
    console.error("[markCommentsRead]", e);
  }
}
