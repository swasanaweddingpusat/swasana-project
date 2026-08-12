import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { submitCandidateSchema } from "@/lib/validations/candidateSubmission";
import { validateFormToken } from "@/lib/recruitment-form-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!mutationLimiter.check(`rf-submit:${ip}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const parsed = submitCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, accessCode, ...fields } = parsed.data;

  try {
    const link = await validateFormToken(token, accessCode);
    if (!link) {
      return NextResponse.json({ error: "Link atau kode akses tidak valid." }, { status: 401 });
    }

    const submission = await db.candidateSubmission.create({
      data: {
        formLinkId: link.id,
        fullName: fields.fullName,
        email: fields.email,
        phoneNumber: fields.phoneNumber,
        address: fields.address ?? null,
        birthPlace: fields.birthPlace ?? null,
        birthDate: fields.birthDate ? new Date(fields.birthDate) : null,
        lastEducation: fields.lastEducation ?? null,
        major: fields.major ?? null,
        workExperienceYears: fields.workExperienceYears ?? null,
        workHistory: fields.workHistory ?? null,
        cvUrl: fields.cvUrl ?? null,
        photoUrl: fields.photoUrl ?? null,
      },
    });

    await logAudit({
      action: "candidate_submission.create",
      entityType: "candidate_submission",
      entityId: submission.id,
      result: "success",
      ipAddress: ip,
      description: `Lamaran diterima dari ${fields.fullName}`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/recruitment-form/submit]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
