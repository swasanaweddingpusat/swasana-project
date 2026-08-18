import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { submitOnboardingFormPublicSchema } from "@/lib/validations/onboardingForm";
import { validateOnboardingFormToken } from "@/lib/onboarding-form-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  if (!mutationLimiter.check(`of-submit:${ip}`)) return rateLimitResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const parsed = submitOnboardingFormPublicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, accessCode, ...fields } = parsed.data;

  try {
    const link = await validateOnboardingFormToken(token, accessCode);
    if (!link) {
      return NextResponse.json({ error: "Link atau kode akses tidak valid." }, { status: 401 });
    }

    const submission = await db.onboardingFormSubmission.create({
      data: {
        formLinkId: link.id,
        divisi: fields.divisi,
        jabatan: fields.jabatan,
        venueId: fields.venueId,
        joinDate: new Date(fields.joinDate),
        fullName: fields.fullName,
        nickName: fields.nickName,
        placeOfBirth: fields.placeOfBirth,
        dateOfBirth: new Date(fields.dateOfBirth),
        phoneNumber: fields.phoneNumber,
        email: fields.email,
        maritalStatus: fields.maritalStatus,
        ktpAddress: fields.ktpAddress,
        currentAddress: fields.currentAddress,
        motherName: fields.motherName,
        numberOfChildren: fields.numberOfChildren,
        lastEducation: fields.lastEducation,
        emergencyContactName: fields.emergencyContactName,
        emergencyContactRel: fields.emergencyContactRel,
        emergencyContactPhone: fields.emergencyContactPhone,
        bankName: fields.bankName,
        bankAccountNumber: fields.bankAccountNumber,
        ktpFileUrl: fields.ktpFileUrl ?? null,
        kkFileUrl: fields.kkFileUrl ?? null,
        photoUrl: fields.photoUrl ?? null,
      },
    });

    await logAudit({
      action: "onboarding_form_submission.create",
      entityType: "onboarding_form_submission",
      entityId: submission.id,
      result: "success",
      ipAddress: ip,
      description: `Data onboarding diterima dari ${fields.fullName}`,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/onboarding-form/submit]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
