import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateRecruitmentFormSchema } from "@/lib/validations/candidateSubmission";
import { validateFormToken } from "@/lib/recruitment-form-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const parsed = validateRecruitmentFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, accessCode } = parsed.data;

  if (!authLimiter.check(`rf-validate:${token}:${ip}`)) return rateLimitResponse();

  try {
    const link = await validateFormToken(token, accessCode);

    if (!link) {
      await logAudit({
        action: "recruitment_form_link.validate_failed",
        entityType: "recruitment_form_link",
        entityId: "unknown",
        result: "failure",
        ipAddress: ip,
        description: "Validasi form link gagal (token/kode salah atau kedaluwarsa)",
      });
      return NextResponse.json({ error: "Link atau kode akses tidak valid." }, { status: 401 });
    }

    // Mark viewedAt on first access
    if (!link.expiresAt) {
      // no-op, just guard
    }
    await db.recruitmentFormLink.updateMany({
      where: { id: link.id, viewedAt: null },
      data: { viewedAt: new Date() },
    });

    await logAudit({
      action: "recruitment_form_link.validate",
      entityType: "recruitment_form_link",
      entityId: link.id,
      result: "success",
      ipAddress: ip,
      description: "Form link berhasil divalidasi",
    });

    return NextResponse.json({
      recruitmentRequest: {
        id: link.recruitmentRequest.id,
        company: link.recruitmentRequest.company,
        department: link.recruitmentRequest.department?.name ?? null,
        position: link.recruitmentRequest.position?.name ?? null,
        level: link.recruitmentRequest.level,
        quota: link.recruitmentRequest.quota,
        workLocation: link.recruitmentRequest.workLocation,
        jobDescriptions: link.recruitmentRequest.jobDescriptions,
        minEducation: link.recruitmentRequest.minEducation,
        minExperience: link.recruitmentRequest.minExperience,
      },
    });
  } catch (e) {
    console.error("[POST /api/recruitment-form/validate]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
