import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { processCandidateImage, uploadCandidateCv } from "@/lib/candidate-files";
import { submitCandidateInviteSchema, publicApplyFilesSchema } from "@/lib/validations/candidate";
import { logAudit } from "@/lib/audit";

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

// ─── POST /api/apply-invite/[token]/submit ─────────────────────────────────────
// Completes a candidate's own record via their personal invite link. No auth
// beyond the access code. One-time use: the link locks permanently on success.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const ip = getIp(req);
  if (!mutationLimiter.check(`invite-submit:${ip}`)) return rateLimitResponse();

  const { token } = await params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ success: false, error: "Format request tidak valid." }, { status: 400 });
  }

  const accessCode = formData.get("accessCode");

  const invite = await db.candidateInvite.findUnique({ where: { token }, select: { id: true, candidateId: true, accessCode: true, status: true } });
  if (!invite) {
    return Response.json({ success: false, error: "Link tidak valid." }, { status: 404 });
  }

  if (invite.status === "Completed") {
    return Response.json({ success: false, locked: true, error: "Link sudah digunakan. Silahkan hubungi admin untuk tindak lanjut." }, { status: 400 });
  }

  if (typeof accessCode !== "string" || invite.accessCode !== accessCode.trim().toUpperCase()) {
    return Response.json({ success: false, error: "Kode akses salah." }, { status: 401 });
  }

  const parsed = submitCandidateInviteSchema.safeParse({
    token,
    accessCode,
    phoneNumber: formData.get("phoneNumber") || undefined,
    religion: formData.get("religion") ?? "",
    expectedSalary: formData.get("expectedSalary") ?? "",
  });
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

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

  // Atomic one-time claim BEFORE any file processing — a request that loses the
  // race is rejected immediately, without wasting an upload/compression cycle.
  const claim = await db.candidateInvite.updateMany({
    where: { token, status: { not: "Completed" } },
    data: { status: "Completed", completedAt: new Date() },
  });
  if (claim.count === 0) {
    return Response.json({ success: false, locked: true, error: "Link sudah digunakan. Silahkan hubungi admin untuk tindak lanjut." }, { status: 400 });
  }

  let resumeUrl: string | null = null;
  let photo: Awaited<ReturnType<typeof processCandidateImage>> | null = null;
  let ktpPhoto: Awaited<ReturnType<typeof processCandidateImage>> | null = null;

  try {
    resumeUrl = await uploadCandidateCv(filesParsed.data.cv, "candidates/cv");
    photo = await processCandidateImage(filesParsed.data.photo, "candidates/photos");
    ktpPhoto = await processCandidateImage(filesParsed.data.ktpPhoto, "candidates/ktp");
  } catch (e) {
    // The invite is already claimed as Completed at this point — a file error
    // here does not roll that back, matching the "locked once submitted" rule.
    // The candidate simply cannot retry; they must contact admin.
    console.error("[apply-invite/submit] file upload error:", e);
    const msg = e instanceof Error ? e.message : "Gagal mengunggah file.";
    return Response.json({ success: false, error: msg }, { status: 400 });
  }

  try {
    await db.candidate.update({
      where: { id: invite.candidateId },
      data: {
        phoneNumber: parsed.data.phoneNumber ?? null,
        religion: parsed.data.religion,
        expectedSalary: parsed.data.expectedSalary,
        resumeUrl: resumeUrl ?? undefined,
        photoUrl: photo?.url ?? undefined,
        photoOriginalName: photo?.originalName ?? undefined,
        photoStorageKey: photo?.storageKey ?? undefined,
        photoMimeType: photo?.mimeType ?? undefined,
        ktpPhotoUrl: ktpPhoto?.url ?? undefined,
        ktpPhotoOriginalName: ktpPhoto?.originalName ?? undefined,
        ktpPhotoStorageKey: ktpPhoto?.storageKey ?? undefined,
        ktpPhotoMimeType: ktpPhoto?.mimeType ?? undefined,
      },
    });

    await logAudit({
      action: "candidate.invite_completed",
      entityType: "candidate",
      entityId: invite.candidateId,
      description: "Kandidat melengkapi data lamaran lewat link undangan personal",
    });

    return Response.json({ success: true });
  } catch (e) {
    console.error("[apply-invite/submit] candidate.update error:", e);
    return Response.json({ success: false, error: "Gagal menyimpan data. Silakan hubungi admin." }, { status: 500 });
  }
}
