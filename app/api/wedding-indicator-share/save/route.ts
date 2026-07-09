import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { saveShareSchema } from "@/lib/validations/weddingIndicatorShare";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";

function calculateSatisfactionScore(
  eventManagerRating: number | null | undefined,
  woRating: number | null | undefined,
  ballroomFacilitiesRating: number | null | undefined,
  ballroomCleanlinessRating: number | null | undefined,
  vendorsRating: number | null | undefined,
  salesRating: number | null | undefined,
  projectManagers: Array<{ rating?: number | null }> = []
): number | null {
  const ratings: number[] = [];
  if (eventManagerRating) ratings.push(eventManagerRating);
  if (woRating) ratings.push(woRating);
  if (ballroomFacilitiesRating) ratings.push(ballroomFacilitiesRating);
  if (ballroomCleanlinessRating) ratings.push(ballroomCleanlinessRating);
  if (vendorsRating) ratings.push(vendorsRating);
  if (salesRating) ratings.push(salesRating);
  projectManagers.forEach((pm) => {
    if (pm.rating) ratings.push(pm.rating);
  });
  if (ratings.length === 0) return null;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}

function calculateAllowance(satisfactionScore: number | null): {
  percentage: number | null;
  nominal: number | null;
} {
  if (satisfactionScore === null) return { percentage: null, nominal: null };
  if (satisfactionScore >= 3.6) return { percentage: 100, nominal: 1000000 };
  if (satisfactionScore >= 3.1) return { percentage: 80, nominal: 800000 };
  if (satisfactionScore >= 2.1) return { percentage: 60, nominal: 600000 };
  if (satisfactionScore >= 1.1) return { percentage: 30, nominal: 300000 };
  return { percentage: 0, nominal: 0 };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
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
      },
    });

    if (!share || share.status !== "Active") {
      return NextResponse.json(
        { error: "Link tidak valid atau sudah tidak aktif" },
        { status: 404 }
      );
    }

    if (share.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json(
        { error: "Kode akses salah" },
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
          eventDate: new Date(formFields.eventDate),
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
