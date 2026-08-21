import { requestUploadUrl } from "@/actions/storage";
import type { UploadFolder } from "@/lib/validations/upload";

const MAX_DIMENSION = 1920;
const WEBP_QUALITY = 0.5;

/**
 * Uploads a file directly to storage via a presigned PUT URL, bypassing the
 * Server Action body size limit. Returns the storage key to submit to the
 * real server action afterwards.
 */
export async function uploadFileDirect(file: File, folder: UploadFolder): Promise<{ key: string }> {
  const presign = await requestUploadUrl({
    folder,
    fileName: file.name,
    contentType: file.type,
    fileSize: file.size,
  });

  if (!presign.success) throw new Error(presign.error);

  const res = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });

  if (!res.ok) throw new Error("Gagal mengunggah file ke storage.");

  return { key: presign.key };
}

/**
 * Mirrors the server's compressToWebp (sharp, resize max 1920x1920, quality 50)
 * but runs in the browser via Canvas — non-image files pass through untouched.
 */
export async function compressImageToWebp(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
  });
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], newName, { type: "image/webp" });
}
