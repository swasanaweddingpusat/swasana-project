import { db } from "@/lib/db";
import { publicApplyLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { uploadToStorage, generateStorageKey } from "@/lib/storage";
import { processCandidateImage } from "@/lib/candidate-files";
import { publicApplySchema, publicApplyFilesSchema } from "@/lib/validations/candidate";
import { applicationConfirmationEmailHtml } from "@/emails/applicationConfirmationEmail";
import { getResendClient } from "@/lib/resend";

const ACCEPTED_CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
// Fallback validation by extension: browsers often report an empty or generic
// MIME type (e.g. "" or application/octet-stream) for Word docs, especially on
// Windows/mobile, so a valid CV would otherwise be rejected on MIME alone.
const ACCEPTED_CV_EXTS = new Set(["pdf", "doc", "docx", "jpg", "jpeg", "png"]);
// When a browser doesn't report a MIME type (common for Word files on Windows),
// derive a proper Content-Type from the extension before uploading to MinIO/S3.
const MIME_BY_EXT: Record<string, string> = {
  pdf:  "application/pdf",
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
  heic: "image/heic",
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ─── POST /api/apply/[token] ───────────────────────────────────────────────────
// Accepts multipart/form-data with text fields + file uploads.
// Creates a Candidate record. No auth required.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!publicApplyLimiter.check(`apply-submit:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  const posting = await db.jobPosting.findUnique({
    where: { publicToken: token },
    select: { id: true, status: true, deletedAt: true, title: true, companyName: true },
  });

  if (!posting || posting.status !== "open" || posting.deletedAt !== null) {
    return Response.json({ success: false, error: "Lowongan tidak tersedia atau sudah ditutup." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ success: false, error: "Format request tidak valid." }, { status: 400 });
  }

  // Validate text fields
  const parsed = publicApplySchema.safeParse({
    formToken: formData.get("formToken") ?? "",
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber") || undefined,
    religion: formData.get("religion") ?? "",
    expectedSalary: formData.get("expectedSalary") ?? "",
  });
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  // Validate CV/photo/KTP files with Zod (presence + size). Format/MIME is
  // checked below by uploadFile/processCandidateImage.
  const rawCv = formData.get("cv");
  const rawPhoto = formData.get("photo");
  const rawKtpPhoto = formData.get("ktpPhoto");
  const filesParsed = publicApplyFilesSchema.safeParse({
    cv: rawCv instanceof File && rawCv.size > 0 ? rawCv : undefined,
    photo: rawPhoto instanceof File && rawPhoto.size > 0 ? rawPhoto : undefined,
    ktpPhoto: rawKtpPhoto instanceof File && rawKtpPhoto.size > 0 ? rawKtpPhoto : undefined,
  });
  if (!filesParsed.success) {
    return Response.json({ success: false, error: filesParsed.error.issues[0].message }, { status: 400 });
  }

  // Reject a repeat application from the same person to the same posting
  // before burning the form token or doing any upload work. The unique
  // index on candidates(jobPostingId, email) is the authoritative guard
  // (race-condition safety net below); this is just the friendly path.
  const existingCandidate = await db.candidate.findFirst({
    where: { jobPostingId: posting.id, email: parsed.data.email },
    select: { id: true },
  });
  if (existingCandidate) {
    return Response.json(
      { success: false, error: "Anda sudah pernah mengirim lamaran untuk lowongan ini." },
      { status: 400 }
    );
  }

  // Atomic one-time claim — after both validations pass (so a clearly invalid
  // request doesn't burn the token) but before any upload work (so a
  // duplicated/replayed valid submission is rejected before expensive work).
  const claim = await db.jobApplicationToken.updateMany({
    where: { token: parsed.data.formToken, jobPostingId: posting.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claim.count === 0) {
    return Response.json(
      { success: false, error: "Sesi form sudah tidak berlaku atau sudah digunakan. Silakan muat ulang halaman." },
      { status: 400 }
    );
  }

  // Upload helper (CV only) — throws on validation failure (wrong format/size).
  // Presence is already guaranteed by publicApplyFilesSchema above. S3
  // connection errors are caught inside and logged rather than surfaced, since
  // a storage outage should not prevent an application from being submitted.
  async function uploadFile(
    field: string,
    folder: string,
    acceptedTypes: Set<string> | RegExp,
    acceptedExts: Set<string>
  ): Promise<string | null> {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) return null;
    if (file.size > MAX_FILE_SIZE) throw new Error(`File ${field} melebihi batas 5MB.`);
    // Derive extension before format check so it can serve as the fallback.
    // Browsers (especially on Windows/mobile) sometimes report an empty or
    // generic MIME type for Word files, so we accept if EITHER the MIME OR
    // the file extension is in the allowed set.
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const mimeOk =
      acceptedTypes instanceof RegExp
        ? acceptedTypes.test(file.type)
        : acceptedTypes.has(file.type);
    if (!mimeOk && !acceptedExts.has(ext)) {
      throw new Error(`Format file ${field} tidak didukung.`);
    }
    const key = generateStorageKey(folder, ext || "bin");
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || MIME_BY_EXT[ext] || "application/octet-stream";
    try {
      return await uploadToStorage(buffer, key, contentType);
    } catch (e) {
      console.error(`[apply] S3 upload failed for "${field}":`, e);
      return null;
    }
  }

  // Compresses to WebP + renames to a random 12-char key. Format errors are
  // fatal (400); upload/network errors are logged and swallowed so a storage
  // outage does not block submission.
  async function uploadImage(file: File, folder: string) {
    try {
      return await processCandidateImage(file, folder);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Format file")) throw e;
      console.error(`[apply] image upload failed for folder "${folder}":`, e);
      return null;
    }
  }

  let resumeUrl: string | null = null;
  let photo: Awaited<ReturnType<typeof uploadImage>> = null;
  let ktpPhoto: Awaited<ReturnType<typeof uploadImage>> = null;

  try {
    resumeUrl = await uploadFile("cv", "candidates/cv", ACCEPTED_CV_TYPES, ACCEPTED_CV_EXTS);
    photo = await uploadImage(filesParsed.data.photo, "candidates/photos");
    ktpPhoto = await uploadImage(filesParsed.data.ktpPhoto, "candidates/ktp");
  } catch (e) {
    // Only validation errors (file too large, unsupported format) reach here.
    const msg = e instanceof Error ? e.message : "Gagal mengunggah file.";
    return Response.json({ success: false, error: msg }, { status: 400 });
  }

  try {
    await db.candidate.create({
      data: {
        jobPostingId: posting.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phoneNumber: parsed.data.phoneNumber ?? null,
        religion: parsed.data.religion,
        expectedSalary: parsed.data.expectedSalary,
        resumeUrl,
        photoUrl: photo?.url ?? null,
        photoOriginalName: photo?.originalName ?? null,
        photoStorageKey: photo?.storageKey ?? null,
        photoMimeType: photo?.mimeType ?? null,
        ktpPhotoUrl: ktpPhoto?.url ?? null,
        ktpPhotoOriginalName: ktpPhoto?.originalName ?? null,
        ktpPhotoStorageKey: ktpPhoto?.storageKey ?? null,
        ktpPhotoMimeType: ktpPhoto?.mimeType ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as { code: string }).code === "P2002") {
      return Response.json(
        { success: false, error: "Anda sudah pernah mengirim lamaran untuk lowongan ini." },
        { status: 400 }
      );
    }
    console.error("[apply/POST] candidate.create error:", e);
    return Response.json({ success: false, error: "Gagal menyimpan lamaran. Silakan coba lagi." }, { status: 500 });
  }

  // Send confirmation email — non-fatal, failure does not affect the response
  try {
    await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: parsed.data.email,
      subject: `Lamaran diterima — ${posting.title}`,
      html: applicationConfirmationEmailHtml({
        fullName: parsed.data.fullName,
        jobTitle: posting.title,
        companyName: posting.companyName ?? "Swasana",
      }),
    });
  } catch {
    // Email failure is non-fatal — application is already saved
  }

  return Response.json({ success: true });
}
