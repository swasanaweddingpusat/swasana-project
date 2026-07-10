import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { authLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { validateShareSchema } from "@/lib/validations/weddingIndicatorShare";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? undefined;

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

    // Rate limit per-token + IP to prevent brute-force on access codes
    if (!authLimiter.check(`wi-share-validate:${token}:${ip}`)) {
      return rateLimitResponse();
    }

    const share = await db.weddingIndicatorShare.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        accessCode: true,
        viewedAt: true,
        weddingIndicator: {
          select: {
            id: true,
            coupleName: true,
            eventDate: true,
            venueId: true,
            venue: { select: { id: true, name: true } },
            eventManagerName: true,
            eventManagerRating: true,
            woName: true,
            woRating: true,
            ballroomFacilitiesRating: true,
            ballroomCleanlinessRating: true,
            vendorsRating: true,
            salesRating: true,
            recommendationScore: true,
            questionnaireData: true,
          },
        },
      },
    });

    // Generic error — do not distinguish "not found" vs "revoked" vs "expired"
    if (!share || share.status !== "Active") {
      await logAudit({
        action: "wedding_indicator.share_validated",
        result: "failure",
        entityType: "WeddingIndicatorShare",
        entityId: token,
        ipAddress: ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 404 }
      );
    }

    // Check expiry
    if (!share.expiresAt || share.expiresAt < new Date()) {
      await logAudit({
        action: "wedding_indicator.share_validated",
        result: "failure",
        entityType: "WeddingIndicatorShare",
        entityId: share.id,
        ipAddress: ip,
        userAgent,
      });
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
      await logAudit({
        action: "wedding_indicator.share_validated",
        result: "failure",
        entityType: "WeddingIndicatorShare",
        entityId: share.id,
        ipAddress: ip,
        userAgent,
      });
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 401 }
      );
    }

    if (!share.viewedAt) {
      await db.weddingIndicatorShare.update({
        where: { id: share.id },
        data: { viewedAt: new Date() },
      });
    }

    await logAudit({
      action: "wedding_indicator.share_validated",
      result: "success",
      entityType: "WeddingIndicatorShare",
      entityId: share.id,
      ipAddress: ip,
      userAgent,
    });

    const indicator = share.weddingIndicator;
    const questionnaireData =
      (indicator.questionnaireData as Record<string, unknown>) ?? {};

    // Strip internal fields — satisfactionScore, allowancePercentage, allowanceNominal
    // are calculated server-side on save and never exposed to the public client
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
        eventManagerNotes: questionnaireData.eventManagerNotes ?? "",
        woNotes: questionnaireData.woNotes ?? "",
        ballroomFacilitiesNotes: questionnaireData.ballroomFacilitiesNotes ?? "",
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
