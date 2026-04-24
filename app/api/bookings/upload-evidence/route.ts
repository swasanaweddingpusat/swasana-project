import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { db } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import sharp from "sharp";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  const { session, response } = await requirePermissionForRoute({ module: "booking", action: "edit" });
  if (response) return response;

  const fd = await req.formData();
  const termId = fd.get("termId") as string;
  const file = fd.get("file") as File;
  if (!termId || !file) return NextResponse.json({ error: "Missing data" }, { status: 400 });

  let buffer: Buffer = Buffer.from(await file.arrayBuffer());
  let contentType = file.type;
  let ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];

  if (IMAGE_TYPES.includes(file.type)) {
    buffer = await sharp(buffer).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 50 }).toBuffer();
    contentType = "image/webp";
    ext = "webp";
  }

  const randomId = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const key = `${randomId}.${ext}`;
  await uploadToR2(buffer, key, contentType);

  await db.termOfPayment.update({ where: { id: termId }, data: { paymentEvidence: key } });

  return NextResponse.json({ filePath: key });
}
