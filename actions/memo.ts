"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import {
  addMemoCommentSchema,
  createMemoSchema,
  updateMemoSchema,
} from "@/lib/validations/memo";

async function generateNoMemo(): Promise<string> {
  const year = new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const count = await db.memo.count({
    where: {
      createdAt: { gte: startOfYear, lt: endOfYear },
    },
  });

  const seq = (count + 1).toString().padStart(3, "0");
  return `MEMO/${year}/${seq}`;
}

export async function createMemo(data: unknown): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "internal-faq", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`memo-create:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = createMemoSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const noMemo = await generateNoMemo();

  try {
    const [memo] = await db.$transaction([
      db.memo.create({
        data: {
          ...parsed.data,
          noMemo,
          createdById: session!.user.profileId,
        },
        select: { id: true, noMemo: true, judul: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "memo.create",
      entityType: "Memo",
      entityId: memo.id,
      description: `Created memo "${memo.noMemo}" — ${memo.judul}`,
    });

    revalidateTag("memos", "max");
    return { success: true };
  } catch (e) {
    console.error("[createMemo]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function updateMemo(
  id: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "internal-faq", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`memo-update:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = updateMemoSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const existing = await db.memo.findUnique({
      where: { id },
      select: { id: true, noMemo: true, judul: true },
    });
    if (!existing) return { success: false, error: "Memo tidak ditemukan." };

    await db.$transaction([
      db.memo.update({
        where: { id },
        data: parsed.data,
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "memo.update",
      entityType: "Memo",
      entityId: id,
      description: `Updated memo "${existing.noMemo}" — ${existing.judul}`,
    });

    revalidateTag("memos", "max");
    return { success: true };
  } catch (e) {
    console.error("[updateMemo]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteMemo(id: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "internal-faq", action: "delete" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`memo-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const existing = await db.memo.findUnique({
      where: { id },
      select: { id: true, noMemo: true, judul: true },
    });
    if (!existing) return { success: false, error: "Memo tidak ditemukan." };

    await db.$transaction([
      db.memo.delete({ where: { id } }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "memo.delete",
      entityType: "Memo",
      entityId: id,
      description: `Deleted memo "${existing.noMemo}" — ${existing.judul}`,
    });

    revalidateTag("memos", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteMemo]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function addMemoComment(
  memoId: string,
  data: unknown
): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "internal-faq", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`memo-comment:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const parsed = addMemoCommentSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const memo = await db.memo.findUnique({
      where: { id: memoId },
      select: { id: true },
    });
    if (!memo) return { success: false, error: "Memo tidak ditemukan." };

    const [comment] = await db.$transaction([
      db.memoComment.create({
        data: {
          memoId,
          authorId: session!.user.profileId,
          content: parsed.data.content,
        },
        select: { id: true },
      }),
    ]);

    await logAudit({
      userId: session!.user.profileId,
      action: "memo.comment",
      entityType: "MemoComment",
      entityId: comment.id,
      description: `Added comment to memo ${memoId}`,
    });

    revalidateTag("memos", "max");
    return { success: true };
  } catch (e) {
    console.error("[addMemoComment]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function markMemoAsRead(memoId: string): Promise<{ success: boolean; error?: string }> {
  const { session, error } = await requirePermission({ module: "internal-faq", action: "view" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`memo-read:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    await db.$transaction([
      db.memoReader.create({
        data: {
          memoId,
          readerId: session!.user.profileId,
        },
      }),
    ]);

    revalidateTag("memos", "max");
    return { success: true };
  } catch {
    // Already marked as read — ignore duplicate constraint error
    return { success: true };
  }
}
