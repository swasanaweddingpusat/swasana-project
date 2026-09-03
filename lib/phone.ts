/**
 * Normalize an Indonesian phone number to a bare MSISDN key (62XXXXXXXXXX),
 * used both as the Bitrix duplicate-match key and for local storage
 * (phoneNumberNorm). Strips spaces, dashes, parentheses and a leading "+".
 * Returns null when the input has too few digits to be a real number.
 */
export function normalizePhoneId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/\D/g, ""); // digits only (drops +, spaces, dashes)
  if (!s) return null;
  if (s.startsWith("62")) {
    // already E.164 country-prefixed — keep
  } else if (s.startsWith("0")) {
    s = "62" + s.slice(1);
  } else if (s.startsWith("8")) {
    s = "62" + s;
  }
  // else: unknown country prefix — keep digits as-is
  if (s.length < 9) return null; // too short to be a valid MSISDN
  return s;
}
