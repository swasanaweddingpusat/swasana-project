/**
 * Resolve a guestbook image value to a displayable full URL.
 *
 * Rules (in order):
 * - Falsy input → null.
 * - Full URL → passthrough.
 * - Bare 12-char file id (visitorPhoto column) → guestbook/{id}.webp key.
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
