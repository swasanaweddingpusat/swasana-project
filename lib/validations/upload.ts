export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export const UPLOAD_FOLDERS = ["booking-documents", "employees-documents", "client-agreements"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;
export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

// Deliberately narrower than ALLOWED_UPLOAD_MIME_TYPES — the manual PO must be a
// PDF so the print/preview flow can serve the uploaded file verbatim in place of
// the system-generated document.
export const ALLOWED_AGREEMENT_UPLOAD_MIME_TYPES = [
  "application/pdf",
] as const;
export type AllowedAgreementUploadMimeType = (typeof ALLOWED_AGREEMENT_UPLOAD_MIME_TYPES)[number];

export function isUploadFolder(value: string): value is UploadFolder {
  return (UPLOAD_FOLDERS as readonly string[]).includes(value);
}

export function isAllowedUploadMimeType(value: string): value is AllowedUploadMimeType {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(value);
}

export function isAllowedAgreementUploadMimeType(value: string): value is AllowedAgreementUploadMimeType {
  return (ALLOWED_AGREEMENT_UPLOAD_MIME_TYPES as readonly string[]).includes(value);
}
