import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateShareSchema } from "@/lib/validations/weddingIndicatorShare";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!apiLimiter.check(`wi-share-validate:${ip}`)) return rateLimitResponse();

  try {
    const body = await req.json();
    const parsed = validateShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Token dan kode akses wajib diisi" },
        { status: 400 }
      );
    }

    const { token, accessCode } = parsed.data;

    const share = await db.weddingIndicatorShare.findUnique({
      where: { token },
      include: {
        weddingIndicator: {
          include: {
            venue: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 404 }
      );
    }

    if (share.status !== "Active") {
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 400 }
      );
    }

    if (share.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json(
        { error: "Kode akses salah" },
        { status: 401 }
      );
    }

    if (!share.viewedAt) {
      await db.weddingIndicatorShare.update({
        where: { token },
        data: { viewedAt: new Date() },
      });
    }

    const indicator = share.weddingIndicator;
    const questionnaireData =
      (indicator.questionnaireData as Record<string, unknown>) ?? {};

    return NextResponse.json({
      indicator: {
        id: indicator.id,
        coupleName: indicator.coupleName,
        eventDate: indicator.eventDate,
        venueId: indicator.venueId,
        venueName: indicator.venue.name,
        eventManagerName: indicator.eventManagerName,
        eventManagerRating: indicator.eventManagerRating,
        woName: indicator.woName,
        woRating: indicator.woRating,
        ballroomFacilitiesRating: indicator.ballroomFacilitiesRating,
        ballroomCleanlinessRating: indicator.ballroomCleanlinessRating,
        vendorsRating: indicator.vendorsRating,
        salesRating: indicator.salesRating,
        recommendationScore: indicator.recommendationScore,
        satisfactionScore: indicator.satisfactionScore,
        allowancePercentage: indicator.allowancePercentage,
        allowanceNominal: indicator.allowanceNominal,
        eventManagerNotes: questionnaireData.eventManagerNotes ?? "",
        woNotes: questionnaireData.woNotes ?? "",
        ballroomFacilitiesNotes:
          questionnaireData.ballroomFacilitiesNotes ?? "",
        ballroomCleanlinessNotes:
          questionnaireData.ballroomCleanlinessNotes ?? "",
        vendorsNotes: questionnaireData.vendorsNotes ?? "",
        salesNotes: questionnaireData.salesNotes ?? "",
        projectManagers: questionnaireData.projectManagers ?? [],
        postWeddingWishes: questionnaireData.postWeddingWishes ?? null,
        notes: questionnaireData.notes ?? "",
        signatures: questionnaireData.signatures ?? null,
        signatureNames: questionnaireData.signatureNames ?? null,
        signatureDate: questionnaireData.signatureDate ?? "",
      },
    });
  } catch (e) {
    console.error("[wi-share-validate]", e);
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
