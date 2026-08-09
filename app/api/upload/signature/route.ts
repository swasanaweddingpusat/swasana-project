import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`signature-upload:${session.user.id}`)) return rateLimitResponse();

  try {
    const fd = await req.formData();
    const file = fd.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "File wajib disertakan." }, { status: 400 });
    }
    if (file.type !== "image/png") {
      return Response.json({ error: "Hanya file PNG yang didukung." }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json({ error: "Ukuran file maksimal 2MB." }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const key = generateStorageKey("signatures", "png");
    const fullUrl = await uploadToStorage(raw, key, "image/png");

    return Response.json({ url: fullUrl });
  } catch {
    return Response.json({ error: "Gagal upload tanda tangan." }, { status: 500 });
  }
}
