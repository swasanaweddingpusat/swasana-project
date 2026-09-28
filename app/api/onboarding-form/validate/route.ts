import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateOnboardingFormSchema } from "@/lib/validations/onboardingForm";
import { validateOnboardingFormToken } from "@/lib/onboarding-form-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  }

  const parsed = validateOnboardingFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { token, accessCode } = parsed.data;

  if (!authLimiter.check(`of-validate:${token}:${ip}`)) return rateLimitResponse();

  try {
    const link = await validateOnboardingFormToken(token, accessCode);

    if (!link) {
      await logAudit({
        action: "onboarding_form_link.validate_failed",
        entityType: "onboarding_form_link",
        entityId: "unknown",
        result: "failure",
        ipAddress: ip,
        description: "Validasi form link onboarding gagal",
      });
      return NextResponse.json({ error: "Link atau kode akses tidak valid." }, { status: 401 });
    }

    await db.onboardingFormLink.updateMany({
      where: { id: link.id, viewedAt: null },
      data: { viewedAt: new Date() },
    });

    const venues = await db.venue.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    await logAudit({
      action: "onboarding_form_link.validate",
      entityType: "onboarding_form_link",
      entityId: link.id,
      result: "success",
      ipAddress: ip,
      description: "Form link onboarding berhasil divalidasi",
    });

    return NextResponse.json({
      onboardingInfo: {
        name: link.name,
      },
      venues,
    });
  } catch (e) {
    console.error("[POST /api/onboarding-form/validate]", e);
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 });
  }
}
