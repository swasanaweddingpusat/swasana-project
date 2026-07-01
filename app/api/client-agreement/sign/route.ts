import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
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

    // Read everything needed BEFORE writing, so the entire effect can commit as a
    // single atomic transaction. Committing "Signed" on its own (as before) left a
    // window where the agreement read "Signed" but the approval step was never
    // approved if a later step failed — a "Signed zombie" that blocked re-signing.
    const booking = await db.booking.findUnique({
      where: { id: agreement.bookingId },
      select: { currentRevisionId: true },
    });

    const approvalRecord = await db.approvalRecord.findUnique({
      where: { module_entityId: { module: "booking", entityId: agreement.bookingId } },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });

    // Always start with the agreement status update + freeze the snapshot layer.
    // The client has now signed the PO exactly as shown, so SnapCustomer / internal
    // items / pricing must not change afterwards. snapshotFrozenAt is set regardless
    // of approval-step state (even legacy bookings without a client step) — the
    // signature itself is the freeze trigger. On regenerate → re-sign, this stamps a
    // fresh timestamp for the newly-signed PO.
    const ops: Prisma.PrismaPromise<unknown>[] = [
      db.clientAgreement.update({
        where: { token },
        data: { status: "Signed", signedAt: new Date() },
      }),
      db.booking.update({
        where: { id: agreement.bookingId },
        data: { snapshotFrozenAt: new Date() },
      }),
    ];

    if (approvalRecord) {
      const allSteps = approvalRecord.steps;

      // Filter by currentRevisionId when available (snapshot approach).
      // Fallback for legacy bookings without currentRevisionId: use all steps that
      // have no revisionId (pre-snapshot data), or all steps if no revisioned data exists.
      const currentRevisionId = booking?.currentRevisionId ?? null;
      const hasRevisionedSteps = allSteps.some((s) => s.revisionId !== null);

      const revisionSteps = (currentRevisionId && hasRevisionedSteps)
        ? allSteps.filter((s) => s.revisionId === currentRevisionId)
        : allSteps;

      // Find pending client step within this revision's steps.
      const clientStep = revisionSteps.find(
        (s) => s.approverType === "client" && s.status === "pending"
      );

      if (clientStep) {
        // All OTHER steps in this revision must be approved before confirming the booking.
        const allOtherApproved = revisionSteps
          .filter((s) => s.id !== clientStep.id)
          .every((s) => s.status === "approved");

        ops.push(
          db.approvalRecordStep.update({
            where: { id: clientStep.id },
            data: {
              status: "approved",
              signature: signatureData,
              decidedAt: new Date(),
            },
          }),
        );
        if (allOtherApproved) {
          ops.push(
            db.approvalRecord.update({
              where: { id: approvalRecord.id },
              data: { status: "approved" },
            }),
            db.booking.update({
              where: { id: agreement.bookingId },
              data: { bookingStatus: "Confirmed" },
            }),
          );
        }
      }
      // If clientStep not found (legacy booking without client step) — signing still
      // updates clientAgreement via ops[0]. No crash; log the audit and return success.
    }

    // Single atomic commit: agreement + step + record + booking all-or-nothing.
    await db.$transaction(ops);

    await logAudit({
      action: "client_signed",
      entityType: "booking",
      entityId: agreement.bookingId,
      description: `Client agreement ditandatangani oleh ${signerName ?? "Client"}`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
