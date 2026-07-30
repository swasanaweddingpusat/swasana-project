import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { requireAnyPermissionForRoute } from "@/lib/permissions";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** POST — receive multipart file, upload to storage, return key */
export async function POST(req: Request): Promise<Response> {
  // Bukti bayar dilampirkan saat membuat/mengedit booking & mencatat cash-in —
  // samakan gate dengan alurnya: create booking (booking:create, step Payment),
  // edit booking / catat-ulang (booking:edit), atau finance catat cash-in
  // (finance-ar:edit). Siapa pun yang boleh mencatat pembayaran boleh upload bukti.
  const { session, response } = await requireAnyPermissionForRoute([
    { module: "booking", action: "create" },
    { module: "booking", action: "edit" },
    { module: "finance-ar", action: "edit" },
  ]);
  if (response) return response;

  if (!mutationLimiter.check(`booking-fee-upload:${session.user.id}`)) {
    return rateLimitResponse();
  }

  try {
    const fd = await req.formData();
    const file = fd.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
      return Response.json(
        { error: "Tipe file tidak didukung. Gunakan JPG, PNG, WebP, atau PDF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "Ukuran file maksimal 10MB." }, { status: 400 });
    }

    // Determine extension from MIME type
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    const ext = extMap[file.type] ?? "bin";

    const raw = Buffer.from(await file.arrayBuffer());
    const key = generateStorageKey("booking-fee-evidence", ext);
    await uploadToStorage(raw, key, file.type);

    return Response.json({ key });
  } catch {
    return Response.json({ error: "Gagal upload bukti bayar." }, { status: 500 });
  }
}
