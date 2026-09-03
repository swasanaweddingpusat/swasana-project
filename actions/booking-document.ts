"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { deleteFromStorage } from "@/lib/storage";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { canAccessBooking } from "@/lib/access-control";
import { isAllowedUploadMimeType, MAX_UPLOAD_SIZE_BYTES } from "@/lib/validations/upload";
import { z } from "zod";

const uploadedDocumentSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES),
});

export async function uploadBookingDocument(formData: FormData) {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`doc-upload:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  const bookingId = formData.get("bookingId") as string;
  const docName = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const documentsRaw = formData.get("documents") as string | null;

  if (!bookingId || !docName || !documentsRaw) {
    return { success: false, error: "Data tidak lengkap." };
  }

  let documents: z.infer<typeof uploadedDocumentSchema>[];
  try {
    const parsed = z.array(uploadedDocumentSchema).safeParse(JSON.parse(documentsRaw));
    if (!parsed.success || parsed.data.length === 0) return { success: false, error: "Data file tidak valid." };
    documents = parsed.data;
  } catch {
    return { success: false, error: "Data file tidak valid." };
  }

  for (const doc of documents) {
    if (!doc.key.startsWith("booking-documents/")) return { success: false, error: "Key file tidak valid." };
    if (!isAllowedUploadMimeType(doc.mimeType)) return { success: false, error: "Tipe file tidak diizinkan." };
  }

  const scope = session!.user.dataScope;
  if (!(await canAccessBooking(session!.user.profileId, scope, bookingId))) {
    return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
  }

  try {
    await db.$transaction(
      documents.map((doc) =>
        db.bookingDocument.create({
          data: {
            bookingId,
            name: docName,
            description,
            filePath: doc.key,
            fileName: doc.name,
            fileSize: doc.size,
            fileType: doc.mimeType,
            uploadedBy: session!.user.profileId,
          },
        })
      )
    );

    await logAudit({
      userId: session!.user.id,
      action: "uploaded",
      entityType: "booking",
      entityId: bookingId,
      description: `Uploaded ${documents.length} file(s) — ${docName}`,
      changes: { documentName: docName, fileCount: documents.length },
    });

    revalidateTag("bookings", "max");
    return { success: true, count: documents.length };
  } catch (e) {
    console.error("[uploadBookingDocument]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteBookingDocument(docId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`doc-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };

  try {
    const doc = await db.bookingDocument.findUnique({
      where: { id: docId },
      select: { id: true, bookingId: true, filePath: true, name: true },
    });
    if (!doc) return { success: false, error: "Dokumen tidak ditemukan." };

    const scope = session!.user.dataScope;
    if (!(await canAccessBooking(session!.user.profileId, scope, doc.bookingId))) {
      return { success: false, error: "Anda tidak memiliki akses ke booking ini." };
    }

    await db.$transaction([db.bookingDocument.delete({ where: { id: docId } })]);
    await deleteFromStorage(doc.filePath).catch((e) => console.error("[deleteBookingDocument] storage delete failed:", e));

    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "booking",
      entityId: doc.bookingId,
      description: `Deleted document: ${doc.name}`,
      changes: { documentName: doc.name },
    });

    revalidateTag("bookings", "max");
    return { success: true };
  } catch (e) {
    console.error("[deleteBookingDocument]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}

export async function deleteBookingDocuments(ids: string[]) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!mutationLimiter.check(`docs-delete:${session!.user.id}`)) return { success: false, ...rateLimitError() };
  if (!ids.length) return { success: false, error: "Tidak ada dokumen yang dipilih." };

  try {
    const docs = await db.bookingDocument.findMany({
      where: { id: { in: ids } },
      select: { id: true, bookingId: true, filePath: true, name: true },
    });
    if (!docs.length) return { success: false, error: "Dokumen tidak ditemukan." };
    type DocItem = typeof docs[number];

    // Ensure user can access ALL bookings referenced by these docs
    const scope = session!.user.dataScope;
    const uniqueBookingIds = [...new Set(docs.map((d: DocItem) => d.bookingId))];
    for (const bId of uniqueBookingIds) {
      if (!(await canAccessBooking(session!.user.profileId, scope, bId))) {
        return { success: false, error: "Anda tidak memiliki akses ke salah satu booking." };
      }
    }

    await db.$transaction([db.bookingDocument.deleteMany({ where: { id: { in: ids } } })]);
    await Promise.all(docs.map((d: DocItem) => deleteFromStorage(d.filePath).catch((e: unknown) => console.error("[deleteBookingDocuments] storage:", e))));

    const bookingId = docs[0].bookingId;
    const names = docs.map((d: DocItem) => d.name).join(", ");
    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "booking",
      entityId: bookingId,
      description: `Deleted ${docs.length} document(s): ${names}`,
      changes: { documentNames: docs.map((d: DocItem) => d.name), count: docs.length },
    });

    revalidateTag("bookings", "max");
    return { success: true, count: docs.length };
  } catch (e) {
    console.error("[deleteBookingDocuments]", e);
    return { success: false, error: "Terjadi kesalahan." };
  }
}
