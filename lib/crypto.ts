import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * AES-256-GCM secret-at-rest helper.
 *
 * Dipakai untuk credential integrasi (mis. API key / bearer token provider AI)
 * yang WAJIB disimpan terenkripsi di DB. Server-only — jangan pernah diimport
 * dari client component.
 *
 * Format ciphertext: `v1.<iv-b64>.<tag-b64>.<payload-b64>`.
 */

const VERSION = "v1";
const IV_BYTES = 12; // GCM standard nonce length
const KEY_ENV = "SECRETS_ENCRYPTION_KEY";

function getKey(): Buffer {
  // Kunci utama dari env khusus; fallback ke AUTH_SECRET supaya deployment lama
  // tetap jalan tanpa env baru. Di-derive lewat SHA-256 agar panjangnya pas 32 byte
  // berapa pun panjang string aslinya.
  const raw = process.env[KEY_ENV] ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error(
      `Enkripsi credential butuh ${KEY_ENV} (atau AUTH_SECRET) di environment.`,
    );
  }
  return createHash("sha256").update(raw).digest();
}

/** Enkripsi plaintext menjadi string siap simpan di kolom DB. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) throw new Error("Nilai rahasia kosong tidak bisa dienkripsi.");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const payload = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [VERSION, iv.toString("base64"), tag.toString("base64"), payload.toString("base64")].join(".");
}

/** Balikkan ciphertext hasil `encryptSecret` ke plaintext. */
export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Format credential terenkripsi tidak dikenali.");
  }

  const [, ivB64, tagB64, payloadB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Preview aman untuk UI — hanya 4 karakter terakhir yang ditampilkan. */
export function maskSecret(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
