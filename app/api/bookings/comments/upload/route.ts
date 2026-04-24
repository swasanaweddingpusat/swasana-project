import { NextResponse } from "next/server";
import { requirePermissionForRoute } from "@/lib/permissions";
import { uploadToR2 } from "@/lib/r2";
import sharp from "sharp";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const { response } = await requirePermissionForRoute({ module: "booking", action: "view" });
  if (response) return response;

  const fd = await req.formData();
  const files = fd.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

  const results: { path: string; name: string; size: number; type: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_SIZE) return NextResponse.json({ error: `${file.name} terlalu besar (max 10MB)` }, { status: 400 });

    let buffer: Buffer = Buffer.from(await file.arrayBuffer()) as Buffer;
    let contentType = file.type;
    let fileName = file.name;

    if (IMAGE_TYPES.includes(file.type)) {
      buffer = await sharp(buffer).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).webp({ quality: 50 }).toBuffer();
      contentType = "image/webp";
      fileName = fileName.replace(/\.[^.]+$/, ".webp");
    }

    const randomId = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, "0")).join("");
    const key = `${randomId}-${fileName}`;
    await uploadToR2(buffer, key, contentType);

    results.push({ path: key, name: fileName, size: buffer.length, type: contentType });
  }

  return NextResponse.json({ attachments: results });
}
