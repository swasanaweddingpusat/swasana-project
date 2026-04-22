"use server";

import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { uploadToR2 } from "@/lib/r2";
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
      entityType: "booking_document",
      entityId: bookingId,
      description: `Uploaded ${results.length} document(s): ${docName}`,
    });

    revalidateTag("bookings", "max");
    return { success: true, count: results.length };
  } catch (e) {
    console.error("[uploadBookingDocument]", e);
    return { success: false, error: "Gagal mengupload dokumen." };
  }
}
