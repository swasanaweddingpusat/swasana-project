import { NextResponse } from "next/server";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateFormToken } from "@/lib/recruitment-form-auth";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_PDF_BYTES = 5 * 1024 * 1024;    // 5 MB

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!mutationLimiter.check(`rf-upload:${ip}`)) return rateLimitResponse();

  try {
    const fd = await req.formData();

    const file = fd.get("file");
    const token = fd.get("token");
    const accessCode = fd.get("accessCode");
    const type = fd.get("type");

    if (typeof token !== "string" || typeof accessCode !== "string") {
      return NextResponse.json({ error: "Token dan kode akses wajib diisi." }, { status: 400 });
    }

    if (type !== "photo" && type !== "cv") {
      return NextResponse.json({ error: "Tipe upload tidak valid. Gunakan 'photo' atau 'cv'." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    // Re-validate token + access code
    const link = await validateFormToken(token, accessCode);
    if (!link) {
      return NextResponse.json({ error: "Link atau kode akses tidak valid." }, { status: 401 });
    }

    if (type === "photo") {
      if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
        return NextResponse.json(
          { error: "Tipe file tidak didukung. Gunakan JPEG, PNG, atau WebP." },
          { status: 400 }
        );
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Ukuran foto maksimal 10MB." }, { status: 400 });
      }

      const raw = Buffer.from(await file.arrayBuffer());
      const compressed = await compressToWebp(raw);
      const key = generateStorageKey("recruitment-form", "webp");
      await uploadToStorage(compressed, key, "image/webp");

      return NextResponse.json({ key });
    }

    // type === "cv"
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "CV harus berupa file PDF." }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Ukuran CV maksimal 5MB." }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    const key = generateStorageKey("recruitment-form", "pdf");
    await uploadToStorage(raw, key, "application/pdf");

    return NextResponse.json({ key });
  } catch (e) {
    console.error("[POST /api/recruitment-form/upload]", e);
    return NextResponse.json({ error: "Gagal upload file." }, { status: 500 });
  }
}
