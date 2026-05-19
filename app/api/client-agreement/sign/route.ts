import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

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

    await db.$transaction([
      db.clientAgreement.update({
        where: { token },
        data: { status: "Signed", signedAt: new Date() },
      }),
    ]);

    // Auto-approve client step in ApprovalRecord
    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: agreement.bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    if (approvalRecord) {
      const allSteps = approvalRecord.steps;
      let latestRoundSteps = allSteps;
      if (allSteps.length > 0) {
        const first = allSteps[0];
        let roundSize = allSteps.length;
        for (let i = 1; i < allSteps.length; i++) {
          if (allSteps[i].approverType === first.approverType &&
              allSteps[i].approverRoleId === first.approverRoleId &&
              allSteps[i].approverUserId === first.approverUserId) {
            roundSize = i;
            break;
          }
        }
        latestRoundSteps = allSteps.slice(-roundSize);
      }

      const clientStep = latestRoundSteps.find(
        (s) => s.approverType === "client" && s.status === "pending"
      );

      if (clientStep) {
        const allOtherApproved = latestRoundSteps
          .filter((s) => s.id !== clientStep.id)
          .every((s) => s.status === "approved");

          await db.$transaction([
            db.approvalRecordStep.update({
              where: { id: clientStep.id },
              data: {
                status: "approved",
                signature: signatureData,
                decidedAt: new Date(),
              },
            }),
            ...(allOtherApproved
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

    await logAudit({
      action: "client_signed",
      entityType: "booking",
      entityId: agreement.bookingId,
      description: `Client agreement ditandatangani oleh ${signerName ?? "Client"}`,
    });

    // Update signatures in the latest revision's snapshotData
    const latestRevision = await db.bookingRevision.findFirst({
      where: { bookingId: agreement.bookingId },
      orderBy: { revisionNumber: "desc" },
      select: { id: true, snapshotData: true },
    });

    if (latestRevision) {
      const snap = (latestRevision.snapshotData as Record<string, unknown>) ?? {};
      await db.bookingRevision.update({
        where: { id: latestRevision.id },
        data: {
          snapshotData: {
            ...snap,
            signatures: {
              ...((snap.signatures as Record<string, unknown>) ?? {}),
              client: {
                name: signerName ?? "",
                role: "client",
                signature: signatureData,
                signatureDate: new Date().toISOString(),
              },
            },
          },
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
