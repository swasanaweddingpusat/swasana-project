import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (!mutationLimiter.check(`ca-sign:${ip}`)) return rateLimitResponse();

  try {
    const { token, accessCode, signatureData, signerName } = await req.json();

    if (!token || !accessCode || !signatureData) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const agreement = await db.clientAgreement.findUnique({ where: { token } });

    if (!agreement) {
      return NextResponse.json({ error: "Link tidak valid" }, { status: 404 });
    }

    if (agreement.status === "Signed") {
      return NextResponse.json({ error: "Agreement sudah ditandatangani" }, { status: 400 });
    }

    if (agreement.expiresAt < new Date()) {
      return NextResponse.json({ error: "Link sudah expired" }, { status: 400 });
    }

    if (agreement.accessCode !== accessCode.trim().toUpperCase()) {
      return NextResponse.json({ error: "Kode akses salah" }, { status: 401 });
    }

    const booking = await db.booking.findUnique({
      where: { id: agreement.bookingId },
      select: { signatures: true },
    });

    const existingSignatures = (booking?.signatures as Record<string, unknown>) ?? {};

    await db.$transaction([
      db.clientAgreement.update({
        where: { token },
        data: { status: "Signed", signedAt: new Date() },
      }),
      db.booking.update({
        where: { id: agreement.bookingId },
        data: {
          signatures: {
            ...existingSignatures,
            client: {
              name: signerName ?? "",
              role: "client",
              signature: signatureData,
              signatureDate: new Date().toISOString(),
            },
          },
        },
      }),
    ]);

    // Auto-approve client step in ApprovalRecord
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: agreement.bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (approvalRecord) {
      const clientStep = approvalRecord.steps.find(
        (s) => s.approverType === "client" && s.status === "pending"
      );

      if (clientStep) {
        // Check all previous steps are approved
        const prevSteps = approvalRecord.steps.filter((s) => s.stepOrder < clientStep.stepOrder);
        const allPrevApproved = prevSteps.every((s) => s.status === "approved");

        if (allPrevApproved) {
          const isLastStep = !approvalRecord.steps.some(
            (s) => s.stepOrder > clientStep.stepOrder && s.status === "pending"
          );

          await db.$transaction([
            db.approvalRecordStep.update({
              where: { id: clientStep.id },
              data: {
                status: "approved",
                signature: signatureData,
                decidedAt: new Date(),
              },
            }),
            ...(isLastStep
              ? [
                  db.approvalRecord.update({
                    where: { id: approvalRecord.id },
                    data: { status: "approved" },
                  }),
                  db.booking.update({
                    where: { id: agreement.bookingId },
                    data: { bookingStatus: "Confirmed" },
                  }),
                ]
              : []),
          ]);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
