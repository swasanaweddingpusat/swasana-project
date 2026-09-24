import sharp from "sharp";

/**
 * Compress an image buffer to WebP format.
 * - Auto-rotate per EXIF orientation (phone photos store portrait shots as
 *   landscape pixels + a rotation flag; browsers auto-rotate for display/
 *   naturalWidth/Height, so the output must match or anything positioned
 *   against the browser's preview — e.g. the festival barcode box — ends up
 *   in the wrong place)
 * - Quality: 50
 * - Resize: max 1920x1920, fit "inside", no enlargement
 *
 * Use this on the server side (API routes / server actions) for all image uploads.
 */
export async function compressToWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 50 })
    .toBuffer();
}
