import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { uploadToR2, getPublicUrl, deleteFromR2 } from "@/lib/r2";
import sharp from "sharp";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "edit" });
  if (response) return response;
  if (!mutationLimiter.check(`upload-evidence:${session.user.id}`)) return rateLimitResponse();

  const fd = await req.formData();
  const termId = fd.get("termId") as string;
  const file = fd.get("file");
  if (!termId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing or invalid file" }, { status: 400 });
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];

  if (IMAGE_TYPES.includes(file.type)) {
    buffer = await sharp(buffer).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 50 }).toBuffer();
    contentType = "image/webp";
    ext = "webp";
  }

  // Fetch existing evidence key so we can delete the old file from R2 after successful upload.
  const existing = await db.termOfPayment.findUnique({
    where: { id: termId },
    select: { paymentEvidence: true },
  });
  const oldKey = existing?.paymentEvidence ?? null;

  const randomId = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `${randomId}.${ext}`;
  await uploadToR2(buffer, key, contentType);
  await db.termOfPayment.update({ where: { id: termId }, data: { paymentEvidence: key } });

  // Best-effort: delete old R2 object. Failure must NOT fail the whole request.
  if (oldKey && oldKey !== key) {
    try {
      await deleteFromR2(oldKey);
    } catch (err) {
      console.error("[upload-evidence] Failed to delete old R2 object", oldKey, err);
    }
  }

  return NextResponse.json({ filePath: getPublicUrl(key) });
}
