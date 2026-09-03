import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { requirePermissionForRoute } from "@/lib/permissions";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** POST — receive multipart file, compress, upload to storage, return key */
export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "settings-banner", action: "create" });
  if (response) return response;
  if (!mutationLimiter.check(`banner-upload:${session.user.id}`)) return rateLimitResponse();

  try {
    const fd = await req.formData();
    const file = fd.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return Response.json({ error: "Tipe file tidak didukung. Gunakan JPEG, PNG, atau WebP." }, { status: 400 });
    }

    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "Ukuran file maksimal 5MB." }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const compressed = await compressToWebp(raw);
    const key = generateStorageKey("banners", "webp");
    await uploadToStorage(compressed, key, "image/webp");

    const fileName = key.split("/").pop();

    return Response.json({
      key,
      path: key,
      fileName,
      originalName: file.name,
      mimeType: "image/webp",
    });
  } catch (e) {
    console.error("[upload/banner]", e);
    return Response.json({ error: "Gagal upload banner." }, { status: 500 });
  }
}
