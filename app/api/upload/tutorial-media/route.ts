import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { requirePermissionForRoute } from "@/lib/permissions";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
];

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_DOC_BYTES = 50 * 1024 * 1024;    // 50 MB

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "settings-tutorial", action: "create" });
  if (response) return response;
  if (!mutationLimiter.check(`tutorial-media-upload:${session.user.id}`)) return rateLimitResponse();

  try {
    const fd = await req.formData();
    const file = fd.get("file");
    const type = fd.get("type") as string | null;

    if (!(file instanceof File)) {
      return Response.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    const isVideo = type === "video";
    const isDoc = type === "document";

    if (!isVideo && !isDoc) {
      return Response.json({ error: "Tipe tidak valid. Gunakan 'video' atau 'document'." }, { status: 400 });
    }

    const allowedTypes = isVideo ? ALLOWED_VIDEO_TYPES : ALLOWED_DOC_TYPES;
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
    const folder = isVideo ? "tutorial-videos" : "tutorial-docs";

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { error: `Tipe file tidak didukung: ${file.type}` },
        { status: 400 },
      );
    }

    if (file.size > maxBytes) {
      const limit = isVideo ? "200MB" : "50MB";
      return Response.json(
        { error: `Ukuran file melebihi batas (${limit}).` },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "bin");
    const key = generateStorageKey(folder, ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToStorage(buffer, key, file.type);

    return Response.json({
      url,
      key,
      name: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
  } catch {
    return Response.json({ error: "Gagal upload file." }, { status: 500 });
  }
}
