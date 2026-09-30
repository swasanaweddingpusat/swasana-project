/**
 * Satu-satunya email yang boleh memakai Chat AI selama fase uji coba.
 * Dipakai di sidebar (menyembunyikan menu) dan di API (gerbang sebenarnya).
 */
export const CHAT_AI_ALLOWED_EMAIL = "hilmianugrah.bn@gmail.com";

export function canUseChatAi(email: string | null | undefined): boolean {
  return email?.toLowerCase() === CHAT_AI_ALLOWED_EMAIL;
}
