"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { uploadToR2, deleteFromR2 } from "@/lib/r2";
import sharp from "sharp";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB raw input

async function processFile(buffer: Buffer, contentType: string, fileName: string): Promise<{ data: Buffer; type: string; name: string }> {
  if (IMAGE_TYPES.includes(contentType)) {
    const compressed = await sharp(buffer).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 50 }).toBuffer();
    const newName = fileName.replace(/\.[^.]+$/, ".webp");
    return { data: compressed, type: "image/webp", name: newName };
  }
  return { data: buffer, type: contentType, name: fileName };
}

export async function uploadBookingDocument(formData: FormData) {
  const { session, error } = await requirePermission({ module: "booking", action: "create" });
  if (error) return { success: false, error };

  const bookingId = formData.get("bookingId") as string;
  const docName = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const files = formData.getAll("files") as File[];

  if (!bookingId || !docName || files.length === 0) {
    return { success: false, error: "Data tidak lengkap." };
  }

  try {
    const results: string[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return { success: false, error: `${file.name} terlalu besar (max 10MB).` };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { data, type, name } = await processFile(buffer, file.type, file.name);
      const ext = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
      const randomId = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const key = `${randomId}.${ext}`;
      const url = await uploadToR2(data, key, type);

      await db.bookingDocument.create({
        data: {
          bookingId,
          name: docName,
          description,
          filePath: key,
          fileName: name,
          fileSize: data.length,
          fileType: type,
          uploadedBy: session!.user.profileId,
        },
      });

      results.push(url);
    }

    await logAudit({
      userId: session!.user.id,
      action: "uploaded",
      entityType: "booking",
      entityId: bookingId,
      description: `Uploaded ${results.length} file(s) — ${docName}`,
      changes: { documentName: docName, fileCount: results.length },
    });

    revalidateTag("bookings", "max");
    return { success: true, count: results.length };
  } catch (e) {
    console.error("[uploadBookingDocument]", e);
    return { success: false, error: "Gagal mengupload dokumen." };
  }
}

export async function deleteBookingDocument(docId: string) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };

  try {
    const doc = await db.bookingDocument.findUnique({
      where: { id: docId },
      select: { id: true, bookingId: true, filePath: true, name: true },
    });
    if (!doc) return { success: false, error: "Dokumen tidak ditemukan." };

    await db.$transaction([db.bookingDocument.delete({ where: { id: docId } })]);
    await deleteFromR2(doc.filePath).catch((e) => console.error("[deleteBookingDocument] R2 delete failed:", e));

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
    return { success: false, error: "Gagal menghapus dokumen." };
  }
}

export async function deleteBookingDocuments(ids: string[]) {
  const { session, error } = await requirePermission({ module: "booking", action: "edit" });
  if (error) return { success: false, error };
  if (!ids.length) return { success: false, error: "Tidak ada dokumen yang dipilih." };

  try {
    const docs = await db.bookingDocument.findMany({
      where: { id: { in: ids } },
      select: { id: true, bookingId: true, filePath: true, name: true },
    });
    if (!docs.length) return { success: false, error: "Dokumen tidak ditemukan." };

    await db.$transaction([db.bookingDocument.deleteMany({ where: { id: { in: ids } } })]);
    await Promise.all(docs.map((d: { id: string; bookingId: string; filePath: string; name: string }) => deleteFromR2(d.filePath).catch((e: unknown) => console.error("[deleteBookingDocuments] R2:", e))));

    const bookingId = docs[0].bookingId;
    const names = docs.map((d) => d.name).join(", ");
    await logAudit({
      userId: session!.user.id,
      action: "deleted",
      entityType: "booking",
      entityId: bookingId,
      description: `Deleted ${docs.length} document(s): ${names}`,
      changes: { documentNames: docs.map((d) => d.name), count: docs.length },
    });

    revalidateTag("bookings", "max");
    return { success: true, count: docs.length };
  } catch (e) {
    console.error("[deleteBookingDocuments]", e);
    return { success: false, error: "Gagal menghapus dokumen." };
  }
}
