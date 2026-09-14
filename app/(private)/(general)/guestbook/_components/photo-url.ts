import type { ProofFiles } from "@/lib/validations/guestbook";

/**
 * Resolve a guestbook image value to a displayable full URL.
 *
 * Rules (in order):
 * - Falsy input → null.
 * - Full URL → passthrough.
 * - Bare file id (legacy, no known caller anymore) → guestbook/{id}.webp key.
 * - Storage key with a slash (proofFiles[].path) → prepend the public base.
 */
export function resolveGuestbookPhotoUrl(value: string | null | undefined): string | null {
  if (!value) return null;

  if (value.startsWith("http")) return value;

  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_URL;
  if (!base) return null;

  if (value.includes("/")) return `${base}/${value}`;

  return `${base}/guestbook/${value}.webp`;
}

/**
 * Pick a displayable thumbnail for a guestbook row: the first proof file that
 * exists, in priority order (visit photo → chat → reschedule → lost). Returns
 * a full URL, or null when no proof was uploaded.
 */
export function resolveGuestbookProofThumb(proofFiles: ProofFiles | null | undefined): string | null {
  if (!proofFiles) return null;

  const path =
    proofFiles.photo?.path ??
    proofFiles.chat?.path ??
    proofFiles.reschedule?.path ??
    proofFiles.lost?.path ??
    null;

  return resolveGuestbookPhotoUrl(path);
}
