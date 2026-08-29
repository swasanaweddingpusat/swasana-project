import { compressToWebp } from "@/lib/image";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";

export type ProcessedImage = {
  url: string;
  storageKey: string;
  mimeType: string;
  originalName: string;
};

const ACCEPTED_IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic"]);

// Compresses to WebP (quality 50, max 1920x1920) and uploads under a random
// 12-char storage key. Used for both the public apply flow and the
// candidate-invite flow so photo/KTP handling stays identical everywhere.
export async function processCandidateImage(file: File, folder: string): Promise<ProcessedImage> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mimeOk = /^image\//.test(file.type) || ACCEPTED_IMAGE_EXTS.has(ext);
  if (!mimeOk) throw new Error("Format file harus JPG/PNG.");

  const buffer = Buffer.from(await file.arrayBuffer());
  const webpBuffer = await compressToWebp(buffer);
  const storageKey = generateStorageKey(folder, "webp");
  const url = await uploadToStorage(webpBuffer, storageKey, "image/webp");

  return { url, storageKey, mimeType: "image/webp", originalName: file.name };
}

const MAX_CV_SIZE = 5 * 1024 * 1024;
const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const ACCEPTED_CV_EXTS = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]);
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

// Uploads a CV as-is (no compression — not an image). Shared by the
// candidate-invite submit flow; the general apply flow keeps its own inline
// copy for now. Throws on invalid format/size.
export async function uploadCandidateCv(file: File, folder: string): Promise<string> {
  if (file.size > MAX_CV_SIZE) throw new Error("File CV melebihi batas 5MB.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mimeOk = ACCEPTED_CV_TYPES.has(file.type) || ACCEPTED_CV_EXTS.has(ext);
  if (!mimeOk) throw new Error("Format file CV tidak didukung.");

  const key = generateStorageKey(folder, ext || "bin");
  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || MIME_BY_EXT[ext] || "application/octet-stream";
  return uploadToStorage(buffer, key, contentType);
}
