"use server";

import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitError } from "@/lib/rate-limit";
import { generateStorageKey, getSignedUploadUrl } from "@/lib/storage";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedUploadMimeType,
  isUploadFolder,
} from "@/lib/validations/upload";
import { z } from "zod";

const requestUploadUrlSchema = z.object({
  folder: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

export async function requestUploadUrl(
  input: unknown
): Promise<{ success: true; uploadUrl: string; key: string } | { success: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (!mutationLimiter.check(`request-upload-url:${session.user.id}`)) {
    return { success: false, ...rateLimitError() };
  }

  const parsed = requestUploadUrlSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { folder, fileName, contentType, fileSize } = parsed.data;

  if (!isUploadFolder(folder)) return { success: false, error: "Folder upload tidak valid." };
  if (!isAllowedUploadMimeType(contentType)) return { success: false, error: "Tipe file tidak diizinkan." };
  if (fileSize > MAX_UPLOAD_SIZE_BYTES) return { success: false, error: "Ukuran file maksimal 10MB." };

  const ext = fileName.split(".").pop() || "bin";
  const key = generateStorageKey(folder, ext);

  try {
    const uploadUrl = await getSignedUploadUrl(key, contentType, fileSize);
    return { success: true, uploadUrl, key };
  } catch (e) {
    console.error("[requestUploadUrl]", e);
    return { success: false, error: "Gagal membuat URL upload." };
  }
}
