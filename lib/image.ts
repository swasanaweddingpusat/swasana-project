import sharp from "sharp";

/**
 * Compress an image buffer to WebP format.
 * - Quality: 50
 * - Resize: max 1920x1920, fit "inside", no enlargement
 *
 * Use this on the server side (API routes / server actions) for all image uploads.
 */
export async function compressToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 50 })
    .toBuffer();
}
