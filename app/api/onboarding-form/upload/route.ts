import { NextResponse } from "next/server";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateOnboardingFormToken } from "@/lib/onboarding-form-auth";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { compressToWebp } from "@/lib/image";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!mutationLimiter.check(`of-upload:${ip}`)) return rateLimitResponse();

  try {
    const fd = await req.formData();

    const file = fd.get("file");
    const token = fd.get("token");
    const accessCode = fd.get("accessCode");
    const type = fd.get("type");

    if (typeof token !== "string" || typeof accessCode !== "string") {
      return NextResponse.json({ error: "Token dan kode akses wajib diisi." }, { status: 400 });
    }

    if (type !== "ktp" && type !== "kk" && type !== "photo") {
      return NextResponse.json(
        { error: "Tipe upload tidak valid. Gunakan 'ktp', 'kk', atau 'photo'." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib disertakan." }, { status: 400 });
    }

    const link = await validateOnboardingFormToken(token, accessCode);
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
      const key = generateStorageKey("onboarding-form", "webp");
      await uploadToStorage(compressed, key, "image/webp");

      return NextResponse.json({ key });
    }

    // type === "ktp" or "kk" — accept images and PDFs
    const allowedTypes = [...ALLOWED_IMAGE_TYPES, "application/pdf"] as readonly string[];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipe file tidak didukung. Gunakan JPEG, PNG, WebP, atau PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "Ukuran file maksimal 10MB." }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf") {
      const key = generateStorageKey("onboarding-form", "pdf");
      await uploadToStorage(raw, key, "application/pdf");
      return NextResponse.json({ key });
    }

    const compressed = await compressToWebp(raw);
    const key = generateStorageKey("onboarding-form", "webp");
    await uploadToStorage(compressed, key, "image/webp");

    return NextResponse.json({ key });
  } catch (e) {
    console.error("[POST /api/onboarding-form/upload]", e);
    return NextResponse.json({ error: "Gagal upload file." }, { status: 500 });
  }
}
