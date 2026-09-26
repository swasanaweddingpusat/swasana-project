import { auth } from "@/lib/auth";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { getFromStorage } from "@/lib/storage";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext && ext in CONTENT_TYPE_BY_EXT) return CONTENT_TYPE_BY_EXT[ext];
  return "image/webp";
}

/**
 * GET — same-origin proxy for CMS-uploaded festival images (`festivals/` folder
 * only). Canvas pixel reads (guestbook ticket generation) require a CORS-safe
 * image source; this route avoids depending on the storage bucket's CORS config
 * by streaming the bytes through our own origin instead.
 */
export async function GET(req: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!apiLimiter.check(`festival-image:${session.user.id}`)) return rateLimitResponse();

  const key = new URL(req.url).searchParams.get("key");
  if (!key || !key.startsWith("festivals/")) {
    return Response.json({ error: "Key tidak valid." }, { status: 400 });
  }

  try {
    const bytes = await getFromStorage(key);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentTypeForKey(key),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[festival-image]", e);
    return Response.json({ error: "Gagal memuat gambar." }, { status: 404 });
  }
}
