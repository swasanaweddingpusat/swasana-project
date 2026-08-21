import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a 12-character lowercase alphanumeric random string using crypto. */
export function randomId12(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
}

/**
 * Build a storage key for a given folder and extension.
 * Example: generateStorageKey("avatars", "webp") → "avatars/abc123def456.webp"
 */
export function generateStorageKey(folder: string, ext: string): string {
  return `${folder}/${randomId12()}.${ext}`;
}

/**
 * Resolve an avatarUrl DB value (key or legacy full URL) to a displayable full URL.
 *
 * Rules:
 * - Falsy input → null.
 * - Relative key (no "http" prefix) → getPublicUrl(key) using current S3_PUBLIC_URL.
 * - Full URL whose hostname matches current S3_PUBLIC_URL host → passthrough (valid MinIO URL).
 * - Full URL from any other host (legacy R2, old domains, etc.) → null (file is gone).
 *
 * This guarantees resolveAvatarUrl never returns a URL for a host that is not
 * registered in next.config.ts remotePatterns.
 */
export function resolveAvatarUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  // Relative storage key — build full URL from current public base
  if (!value.startsWith("http")) return getPublicUrl(value);

  // Full URL: check if the hostname matches the current storage host
  try {
    const incomingHost = new URL(value).hostname;
    const currentHost = new URL(PUBLIC_URL).hostname;
    if (incomingHost === currentHost) return value;
    // Legacy host (r2.dev, old domains) — file is gone, return null so UI falls back to initials
    return null;
  } catch {
    // Malformed URL
    return null;
  }
}

function buildS3Config(): S3ClientConfig {
  // Generic S3-compatible (MinIO, Railway, etc.)
  return {
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  };
}

export const storageClient = new S3Client(buildS3Config());

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

export async function uploadToStorage(
  file: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await storageClient.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Fetch an object from storage as raw bytes. Used to stream an uploaded PDF
 * (e.g. a manually-signed PO) back through a route handler in place of a
 * system-generated document.
 */
export async function getFromStorage(key: string): Promise<Uint8Array> {
  const res = await storageClient.send(
    new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
  if (!res.Body) throw new Error(`Empty body for storage object: ${key}`);
  return res.Body.transformToByteArray();
}

export async function deleteFromStorage(key: string): Promise<void> {
  await storageClient.send(
    new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
  );
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn = 300
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });
  return getSignedUrl(storageClient, command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

export function extractKeyFromUrl(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, "");
}
