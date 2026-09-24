const HTML_ENTITY_MAP: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

/**
 * Convert persisted editor HTML into inert printable text.
 * Quotation content is user-editable, so preview/PDF output must not inject it
 * into the DOM. Basic block/list spacing is retained for readability.
 */
export function richTextToPlainText(value: string | null | undefined): string {
  if (!value) return "";

  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li(?:\s[^>]*)?>/gi, "• ")
    .replace(/<\/(?:div|li|ol|p|ul)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith("#")) {
        const radix = code.startsWith("#x") || code.startsWith("#X") ? 16 : 10;
        const digits = radix === 16 ? code.slice(2) : code.slice(1);
        const point = Number.parseInt(digits, radix);
        return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : entity;
      }
      return HTML_ENTITY_MAP[code.toLowerCase()] ?? entity;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
