import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { saveShareSchema } from "@/lib/validations/weddingIndicatorShare";
import {
  calculateAllowance,
  calculateSatisfactionScore,
} from "@/lib/utils/weddingIndicatorUtils";
import { revalidateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? undefined;
  if (!mutationLimiter.check(`wi-share-save:${ip}`)) return rateLimitResponse();

  try {
    const body = await req.json();
    const parsed = saveShareSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Validasi gagal";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { token, accessCode, ...formFields } = parsed.data;

    const share = await db.weddingIndicatorShare.findUnique({
      where: { token },
      select: {
        id: true,
        weddingIndicatorId: true,
        accessCode: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!share || share.status !== "Active") {
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 404 }
      );
    }

    // Check expiry
    if (!share.expiresAt || share.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Link tidak valid atau kedaluwarsa" },
        { status: 404 }
      );
    }

    // Timing-safe access code comparison
    const a = Buffer.from(share.accessCode);
    const b = Buffer.from(accessCode.trim().toUpperCase());
    const codeOk = a.length === b.length && timingSafeEqual(a, b);
    if (!codeOk) {
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 401 }
      );
    }

    const satisfactionScore = calculateSatisfactionScore(
      formFields.eventManagerRating,
      formFields.woRating,
      formFields.ballroomFacilitiesRating,
      formFields.ballroomCleanlinessRating,
      formFields.vendorsRating,
      formFields.salesRating,
      formFields.projectManagers
    );

    const { percentage: allowancePercentage, nominal: allowanceNominal } =
      calculateAllowance(satisfactionScore);

    const questionnaireData: Prisma.InputJsonObject = {
      eventManagerNotes: formFields.eventManagerNotes,
      woNotes: formFields.woNotes,
      ballroomFacilitiesNotes: formFields.ballroomFacilitiesNotes,
      ballroomCleanlinessNotes: formFields.ballroomCleanlinessNotes,
      vendorsNotes: formFields.vendorsNotes,
      salesNotes: formFields.salesNotes,
      projectManagers: formFields.projectManagers as Prisma.InputJsonValue,
      postWeddingWishes: (formFields.postWeddingWishes ?? {}) as Prisma.InputJsonValue,
      notes: formFields.notes,
      signatures: (formFields.signatures ?? {}) as Prisma.InputJsonValue,
      signatureNames: (formFields.signatureNames ?? {}) as Prisma.InputJsonValue,
      signatureDate: formFields.signatureDate,
    };

    await db.$transaction([
      db.weddingIndicator.update({
        where: { id: share.weddingIndicatorId },
        data: {
          coupleName: formFields.coupleName,
          eventDate: formFields.eventDate,
          eventManagerName: formFields.eventManagerName,
          eventManagerRating: formFields.eventManagerRating,
          woName: formFields.woName,
          woRating: formFields.woRating,
          ballroomFacilitiesRating: formFields.ballroomFacilitiesRating,
          ballroomCleanlinessRating: formFields.ballroomCleanlinessRating,
          vendorsRating: formFields.vendorsRating,
          salesRating: formFields.salesRating,
          recommendationScore: formFields.recommendationScore,
          satisfactionScore,
          allowancePercentage,
          allowanceNominal,
          questionnaireData,
        },
      }),
      db.weddingIndicatorShare.update({
        where: { id: share.id },
        data: { lastEditedAt: new Date() },
      }),
    ]);

    await logAudit({
      action: "wedding_indicator.client_saved",
      result: "success",
      entityType: "WeddingIndicator",
      entityId: share.weddingIndicatorId,
      ipAddress: ip,
      userAgent,
    });

    revalidateTag("wedding-indicators", "max");

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[wi-share-save]", e);
    return NextResponse.json(
      { error: "Gagal menyimpan kuesioner" },
      { status: 500 }
    );
  }
}
