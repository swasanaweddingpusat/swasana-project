import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { isAllowedAgreementUploadMimeType, MAX_UPLOAD_SIZE_BYTES } from "@/lib/validations/upload";
import { extractPoNumberFromPdf } from "@/lib/ai/claude";

/**
 * Baca nomor PO dari PDF yang DIPILIH staff (belum tentu diupload) pakai Claude
 * via 9router — buat auto-fill field "Nomor PO" + indikator cocok/tidak.
 *
 * Read-only assist: TIDAK menyimpan ke S3 dan TIDAK menyentuh approval. Gerbang
 * final tetap `uploadManualAgreement` (guard noPO === poNumber sistem di server).
 */
export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "client-agreement" });
  if (response) return response;

  if (!mutationLimiter.check(`extract-po:${session.user.id}`)) return rateLimitResponse();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, error: "File wajib diisi." }, { status: 400 });
  }
  if (!isAllowedAgreementUploadMimeType(file.type)) {
    return Response.json({ success: false, error: "File harus PDF." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return Response.json({ success: false, error: "Ukuran file maksimal 10MB." }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const result = await extractPoNumberFromPdf(base64);
    return Response.json({ success: true as const, ...result });
  } catch (e) {
    console.error("[extract-po]", e);
    return Response.json({ success: false as const, error: "Gagal membaca dokumen." }, { status: 502 });
  }
}
