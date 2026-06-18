import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "comment" });
  if (response) return response;
  if (!mutationLimiter.check(`comment-upload:${session.user.id}`)) return rateLimitResponse();

  const fd = await req.formData();
  const files = fd.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const results: { path: string; name: string; size: number; type: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `${file.name} terlalu besar (max 10MB)` }, { status: 400 });
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let contentType = file.type;
    let fileName = file.name;
    let key: string;

    if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
      buffer = await compressToWebp(buffer);
      contentType = "image/webp";
      fileName = fileName.replace(/\.[^.]+$/, ".webp");
      key = generateStorageKey("booking-comments", "webp");
    } else {
      const ext = file.name.split(".").pop() ?? "bin";
      key = generateStorageKey("booking-comments", ext);
    }

    await uploadToStorage(buffer, key, contentType);
    results.push({ path: key, name: fileName, size: buffer.length, type: contentType });
  }

  return NextResponse.json({ attachments: results });
}
