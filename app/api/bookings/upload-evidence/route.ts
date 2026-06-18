import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { uploadToStorage, getPublicUrl, deleteFromStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

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
  let key: string;

  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    buffer = await compressToWebp(buffer);
    contentType = "image/webp";
    key = generateStorageKey("payment-evidence", "webp");
  } else {
    const ext = file.name.split(".").pop() ?? "bin";
    key = generateStorageKey("payment-evidence", ext);
  }

  // Fetch existing evidence key to delete old file after successful upload
  const existing = await db.termOfPayment.findUnique({
    where: { id: termId },
    select: { paymentEvidence: true },
  });
  const oldKey = existing?.paymentEvidence ?? null;

  await uploadToStorage(buffer, key, contentType);
  await db.termOfPayment.update({ where: { id: termId }, data: { paymentEvidence: key } });

  // Best-effort: delete old storage object
  if (oldKey && oldKey !== key) {
    await deleteFromStorage(oldKey).catch((err: unknown) => {
      console.error("[upload-evidence] Failed to delete old storage object", oldKey, err);
    });
  }

  return NextResponse.json({ filePath: getPublicUrl(key) });
}
