"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { deleteFromStorage } from "@/lib/storage";
import { saveEditDraftSchema, discardEditDraftSchema } from "@/lib/validations/booking-edit-draft";

export interface EditDraftResult {
  success: boolean;
  error?: string;
}

/**
 * Upsert buffer edit yang belum di-commit untuk sebuah booking saved.
 * Dipanggil oleh autosave drawer saat ada perubahan material.
 */
export async function saveEditDraft(data: unknown): Promise<EditDraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`edit-draft-save:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = saveEditDraftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { bookingId, formState, pendingUploads } = parsed.data;
  const editorProfileId = session!.user.profileId!;

  try {
    // Pastikan booking ada & saved (tidak mengedit draft create).
    const booking = await db.booking.findFirst({
      where: { id: bookingId, recordStatus: "saved" },
      select: { id: true },
    });
    if (!booking) return { success: false, error: "Booking tidak ditemukan." };

    await db.bookingEditDraft.upsert({
      where: { bookingId },
      create: {
        bookingId,
        editorProfileId,
        formState: formState as object,
        pendingUploads: pendingUploads as object,
      },
      update: {
        editorProfileId,
        formState: formState as object,
        pendingUploads: pendingUploads as object,
      },
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal menyimpan perubahan sementara." };
  }
}

/**
 * Buang buffer edit + hapus file storage yang sempat diupload sesi ini (orphan cleanup).
 * Tidak menyentuh data live booking.
 */
export async function discardEditDraft(data: unknown): Promise<EditDraftResult> {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`edit-draft-discard:${session!.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = discardEditDraftSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { bookingId } = parsed.data;

  try {
    const draft = await db.bookingEditDraft.findUnique({
      where: { bookingId },
      select: { id: true, pendingUploads: true },
    });
    if (!draft) return { success: true }; // idempotent: tidak ada yang dibuang

    // Hapus row dulu (atomic), lalu cleanup storage best-effort.
    await db.bookingEditDraft.delete({ where: { bookingId } });

    const keys = Array.isArray(draft.pendingUploads) ? (draft.pendingUploads as string[]) : [];
    for (const key of keys) {
      try {
        await deleteFromStorage(key);
      } catch {
        // best-effort: orphan storage tidak memblok discard
      }
    }

    await logAudit({
      userId: session!.user.id,
      action: "edit_draft_discarded",
      entityType: "booking",
      entityId: bookingId,
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch {
    return { success: false, error: "Gagal membuang perubahan." };
  }
}
