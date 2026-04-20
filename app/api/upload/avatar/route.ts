import { auth } from "@/lib/auth";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getSignedUploadUrl, getPublicUrl, deleteFromR2 } from "@/lib/r2";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`avatar-upload:${session.user.id}`)) return rateLimitResponse();

  try {
    const { contentType } = await req.json() as { contentType: string };

    if (contentType !== "image/webp") {
      return Response.json({ error: "Only WebP allowed" }, { status: 400 });
    }

    const key = `profiles/${session.user.id}/${crypto.randomUUID()}.webp`;
    const uploadUrl = await getSignedUploadUrl(key, contentType, 300); // 5 min expiry
    const publicUrl = getPublicUrl(key);

    return Response.json({ uploadUrl, publicUrl, key });
  } catch {
    return Response.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`avatar-save:${session.user.id}`)) return rateLimitResponse();

  try {
    const { avatarUrl, oldKey } = await req.json() as { avatarUrl: string; oldKey?: string };

    // Delete old avatar from R2 if exists
    if (oldKey && oldKey.startsWith("profiles/")) {
      await deleteFromR2(oldKey).catch(() => {}); // non-blocking
    }

    await db.profile.update({
      where: { userId: session.user.id },
      data: { avatarUrl },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Failed to save avatar" }, { status: 500 });
  }
}
