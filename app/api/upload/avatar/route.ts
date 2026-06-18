import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, deleteFromStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";
import { db } from "@/lib/db";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** POST — receive multipart file, compress, upload to storage, return key */
export async function POST(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`avatar-upload:${session.user.id}`)) return rateLimitResponse();

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
    const key = generateStorageKey("avatars", "webp");
    await uploadToStorage(compressed, key, "image/webp");

    return Response.json({ key });
  } catch {
    return Response.json({ error: "Gagal upload foto." }, { status: 500 });
  }
}

/** PATCH — save key to DB, delete old avatar from storage */
export async function PATCH(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`avatar-save:${session.user.id}`)) return rateLimitResponse();

  try {
    const { avatarKey, oldKey } = await req.json() as { avatarKey: string; oldKey?: string };

    if (typeof avatarKey !== "string" || !avatarKey) {
      return Response.json({ error: "avatarKey wajib diisi." }, { status: 400 });
    }

    // Delete old avatar from storage (best-effort, non-blocking)
    if (oldKey && oldKey !== avatarKey) {
      await deleteFromStorage(oldKey).catch(() => {});
    }

    await db.profile.update({
      where: { userId: session.user.id },
      data: { avatarUrl: avatarKey },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Gagal menyimpan foto profil." }, { status: 500 });
  }
}
