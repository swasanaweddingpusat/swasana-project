import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";
import { mutationLimiter, rateLimitResponse } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!mutationLimiter.check(`reset-step:${session.user.id}`)) return rateLimitResponse();

  const isAdmin = await isSuperAdmin(session.user.roleId);
  if (!isAdmin) return Response.json({ error: "Hanya super-admin yang bisa reset step" }, { status: 403 });

  const { stepId } = await req.json();
  if (!stepId) return Response.json({ error: "stepId wajib diisi" }, { status: 400 });

  try {
    const step = await db.approvalRecordStep.findUnique({
      where: { id: stepId },
      include: { record: true },
    });
    if (!step) return Response.json({ error: "Step tidak ditemukan" }, { status: 404 });

    await db.$transaction([
      db.approvalRecordStep.update({
        where: { id: stepId },
        data: { status: "pending", decidedById: null, decidedAt: null, signature: null },
      }),
      db.approvalRecord.update({
        where: { id: step.recordId },
        data: { status: "pending" },
      }),
      ...(step.record.module === "booking" ? [
        db.booking.update({ where: { id: step.record.entityId }, data: { bookingStatus: "Pending" } }),
        db.clientAgreement.updateMany({ where: { bookingId: step.record.entityId }, data: { status: "Pending", signedAt: null, viewedAt: null } }),
      ] : []),
    ]);

    await logAudit({
      userId: session.user.profileId,
      action: "approval.step_reset",
      entityType: step.record.module,
      entityId: step.record.entityId,
      description: `Step ${step.stepOrder} (${step.approverType}) di-reset oleh admin`,
      changes: { stepId, stepOrder: step.stepOrder, approverType: step.approverType },
    });

    revalidateTag("approvals", { expire: 0 });
    revalidateTag("bookings", { expire: 0 });

    return Response.json({ success: true });
  } catch (e) {
    console.error("[reset-step]", e);
    return Response.json({ error: "Gagal reset step" }, { status: 500 });
  }
}
