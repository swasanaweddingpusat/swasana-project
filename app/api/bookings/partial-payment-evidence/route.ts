import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export async function POST(req: Request): Promise<Response> {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "edit" });
  if (response) return response;
  if (!mutationLimiter.check(`upload-pp-evidence:${session.user.id}`)) return rateLimitResponse();

  const fd = await req.formData();
  const paymentId = fd.get("paymentId") as string;
  const file = fd.get("file");
  if (!paymentId || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let key: string;

  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    buffer = await compressToWebp(buffer);
    contentType = "image/webp";
    key = generateStorageKey("payment-evidence/partial", "webp");
  } else {
    const ext = file.name.split(".").pop() ?? "bin";
    key = generateStorageKey("payment-evidence/partial", ext);
  }

  await uploadToStorage(buffer, key, contentType);

  await db.$transaction([
    db.partialPayment.update({ where: { id: paymentId }, data: { evidence: key } }),
  ]);

  return NextResponse.json({ filePath: key });
}
