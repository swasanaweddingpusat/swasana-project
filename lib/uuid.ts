/**
 * Generate a RFC4122 v4 UUID that works in every browser context.
 *
 * `crypto.randomUUID()` is only exposed in a *secure context* (HTTPS or
 * `localhost`). When the app is opened over plain HTTP on a LAN IP — e.g.
 * `http://192.168.1.4:3200` from a phone during testing — `crypto.randomUUID`
 * is `undefined` and calling it throws. This helper prefers the native API
 * when available and falls back to a `crypto.getRandomValues`-backed
 * implementation, finally degrading to `Math.random` only if no crypto API
 * exists at all.
 */
export function safeRandomUUID(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  // Fallback: build a v4 UUID from random bytes.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // Per RFC4122 §4.4: set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
