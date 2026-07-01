import { randomInt } from "crypto";

/**
 * Generates a 6-character uppercase alphanumeric access code using a CSPRNG.
 *
 * Replaces `Math.random().toString(36)...` which is NOT cryptographically secure
 * and can be predicted from PRNG state. Access codes gate client-agreement signing
 * (no auth), so they must be unguessable.
 *
 * Alphabet excludes ambiguous chars (0/O, 1/I) to keep codes easy to read/type.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no 0/O/1/I

export function generateAccessCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
}
